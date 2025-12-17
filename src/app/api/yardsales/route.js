// src/app/api/yardsales/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import YardSale from '@/models/YardSale';
import { sanitizeText } from '@/lib/sanitizeInput';
import { verifyToken } from '@/firebase/verifyToken';
import { reverseGeocodeWithQueue } from '@/lib/reverseGeocodingHelper';

// POST - Create a new yard sale
export async function POST(request) {
  try {
    await connectDB();
    
    const body = await request.json();
    const { title, description, saleDate, saleTime, location, address, contactInfo, priceRange, images, uid } = body;

    // Verify authentication token
    const decodedToken = await verifyToken(request);
    if (!decodedToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing authentication token' },
        { status: 401 }
      );
    }

    const userId = uid || decodedToken.uid;

    // Verify that the user is accessing their own data (if uid is provided)
    if (uid && decodedToken.uid !== uid) {
      return NextResponse.json(
        { error: 'Forbidden: You can only create yard sales for your own account' },
        { status: 403 }
      );
    }

    // Find user by firebaseUid
    const user = await User.findOne({ firebaseUid: userId });
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is banned
    if (user.moderation?.banned === true) {
      return NextResponse.json(
        { error: 'Account is banned' },
        { status: 403 }
      );
    }

    // Check if user has pincode set
    const userPincode = user.profile?.pincode;
    if (!userPincode) {
      return NextResponse.json(
        { error: 'Pincode is required. Please set your pincode in your profile.' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      return NextResponse.json(
        { error: 'Valid location with lat and lng is required' },
        { status: 400 }
      );
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    if (!saleDate) {
      return NextResponse.json(
        { error: 'Sale date is required' },
        { status: 400 }
      );
    }

    if (!address || typeof address !== 'string' || address.trim().length === 0) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    // Validate location coordinates
    if (location.lat < -90 || location.lat > 90 || location.lng < -180 || location.lng > 180) {
      return NextResponse.json(
        { error: 'Invalid location coordinates' },
        { status: 400 }
      );
    }

    // Validate sale date is in the future or today
    const saleDateObj = new Date(saleDate);
    if (isNaN(saleDateObj.getTime())) {
      return NextResponse.json(
        { error: 'Invalid sale date' },
        { status: 400 }
      );
    }

    // Allow current day and future dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const saleDateOnly = new Date(saleDateObj);
    saleDateOnly.setHours(0, 0, 0, 0);
    
    if (saleDateOnly < today) {
      return NextResponse.json(
        { error: 'Sale date must be today or in the future' },
        { status: 400 }
      );
    }

    // Validate images
    if (images && Array.isArray(images)) {
      if (images.length > 4) {
        return NextResponse.json(
          { error: 'Maximum 4 images allowed' },
          { status: 400 }
        );
      }
      // Validate base64 format (basic check)
      for (const image of images) {
        if (typeof image !== 'string' || !image.startsWith('data:image/')) {
          return NextResponse.json(
            { error: 'Invalid image format. Images must be base64 encoded.' },
            { status: 400 }
          );
        }
      }
    }

    // Reverse geocode location to verify pincode matches
    let locationPincode;
    try {
      locationPincode = await reverseGeocodeWithQueue(location.lat, location.lng, 30);
    } catch (error) {
      return NextResponse.json(
        { error: error.message || 'Could not determine pincode for selected location. Please select a valid location.' },
        { status: 400 }
      );
    }

    // Normalize pincodes (remove dashes, take first 5 digits)
    const normalizedUserPincode = userPincode.replace(/-/g, '').slice(0, 5);
    const normalizedLocationPincode = locationPincode.replace(/-/g, '').slice(0, 5);

    if (normalizedUserPincode !== normalizedLocationPincode) {
      return NextResponse.json(
        { error: `Selected location is not within your pincode (${userPincode}). You can only create yard sales in your pincode area.` },
        { status: 400 }
      );
    }

    // Sanitize input
    const sanitizedTitle = sanitizeText(title.trim());
    const sanitizedDescription = sanitizeText(description.trim());
    const sanitizedAddress = sanitizeText(address.trim());

    // Validate sanitized fields are not empty
    if (sanitizedTitle.length === 0 || sanitizedDescription.length === 0 || sanitizedAddress.length === 0) {
      return NextResponse.json(
        { error: 'Title, description, and address cannot be empty after sanitization' },
        { status: 400 }
      );
    }

    // Validate length limits
    if (sanitizedTitle.length < 3 || sanitizedTitle.length > 200) {
      return NextResponse.json(
        { error: 'Title must be between 3 and 200 characters' },
        { status: 400 }
      );
    }

    if (sanitizedDescription.length < 10 || sanitizedDescription.length > 2000) {
      return NextResponse.json(
        { error: 'Description must be between 10 and 2000 characters' },
        { status: 400 }
      );
    }

    // Create yard sale
    const yardSale = await YardSale.create({
      createdBy: user._id,
      title: sanitizedTitle,
      description: sanitizedDescription,
      saleDate: saleDateObj,
      saleTime: saleTime ? saleTime.trim() : null,
      location: {
        lat: location.lat,
        lng: location.lng
      },
      address: sanitizedAddress,
      pincode: normalizedUserPincode,
      contactInfo: contactInfo ? {
        phone: contactInfo.phone ? contactInfo.phone.trim() : null,
        email: contactInfo.email ? contactInfo.email.trim() : null
      } : null,
      priceRange: priceRange ? priceRange.trim() : null,
      images: images || []
    });

    // Populate creator info
    await yardSale.populate('createdBy', 'firebaseUid firstName lastName photoURL');

    return NextResponse.json({
      success: true,
      yardSale: {
        _id: yardSale._id,
        title: yardSale.title,
        description: yardSale.description,
        saleDate: yardSale.saleDate,
        saleTime: yardSale.saleTime,
        location: yardSale.location,
        address: yardSale.address,
        pincode: yardSale.pincode,
        contactInfo: yardSale.contactInfo,
        priceRange: yardSale.priceRange,
        images: yardSale.images,
        createdBy: {
          _id: yardSale.createdBy._id,
          firebaseUid: yardSale.createdBy.firebaseUid,
          name: `${yardSale.createdBy.firstName} ${yardSale.createdBy.lastName}`,
          photoURL: yardSale.createdBy.photoURL
        },
        createdAt: yardSale.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating yard sale:', error);
    return NextResponse.json(
      { error: 'Failed to create yard sale' },
      { status: 500 }
    );
  }
}

// GET - List yard sales in user's pincode
export async function GET(request) {
  try {
    await connectDB();
    
    // Verify authentication token
    const decodedToken = await verifyToken(request);
    if (!decodedToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing authentication token' },
        { status: 401 }
      );
    }

    // Find user by firebaseUid
    const user = await User.findOne({ firebaseUid: decodedToken.uid });
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user has pincode set
    const userPincode = user.profile?.pincode;
    if (!userPincode) {
      return NextResponse.json(
        { error: 'Pincode is required. Please set your pincode in your profile.' },
        { status: 400 }
      );
    }

    // Normalize pincode
    const normalizedPincode = userPincode.replace(/-/g, '').slice(0, 5);

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const includePast = searchParams.get('includePast') === 'true';
    const limit = parseInt(searchParams.get('limit')) || 100;

    // Build query
    const query = {
      pincode: normalizedPincode
    };

    // Filter by date if not including past yard sales
    if (!includePast) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query.saleDate = { $gte: today };
    }

    // Fetch yard sales
    const yardSales = await YardSale.find(query)
      .populate('createdBy', 'firebaseUid firstName lastName photoURL')
      .sort({ saleDate: 1 }) // Sort by sale date ascending (upcoming first)
      .limit(limit)
      .lean();

    // Format yard sales
    const formattedYardSales = yardSales.map(yardSale => ({
      _id: yardSale._id,
      title: yardSale.title,
      description: yardSale.description,
      saleDate: yardSale.saleDate,
      saleTime: yardSale.saleTime,
      location: yardSale.location,
      address: yardSale.address,
      pincode: yardSale.pincode,
      contactInfo: yardSale.contactInfo,
      priceRange: yardSale.priceRange,
      images: yardSale.images,
      createdBy: {
        _id: yardSale.createdBy._id,
        firebaseUid: yardSale.createdBy.firebaseUid,
        name: `${yardSale.createdBy.firstName} ${yardSale.createdBy.lastName}`,
        photoURL: yardSale.createdBy.photoURL
      },
      createdAt: yardSale.createdAt,
      isOwner: yardSale.createdBy._id.toString() === user._id.toString()
    }));

    return NextResponse.json({
      success: true,
      yardSales: formattedYardSales,
      count: formattedYardSales.length
    });
  } catch (error) {
    console.error('Error fetching yard sales:', error);
    return NextResponse.json(
      { error: 'Failed to fetch yard sales', yardSales: [] },
      { status: 500 }
    );
  }
}

