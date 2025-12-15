// src/app/api/yardsales/[id]/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import YardSale from '@/models/YardSale';
import { sanitizeText } from '@/lib/sanitizeInput';
import { verifyToken } from '@/firebase/verifyToken';
import { reverseGeocodeWithQueue } from '@/lib/reverseGeocodingHelper';

// GET - Get yard sale details
export async function GET(request, { params }) {
  try {
    await connectDB();
    
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Yard sale ID is required' },
        { status: 400 }
      );
    }

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
    const normalizedUserPincode = userPincode.replace(/-/g, '').slice(0, 5);

    // Find the yard sale
    const yardSale = await YardSale.findById(id).populate('createdBy', 'firebaseUid firstName lastName photoURL');
    if (!yardSale) {
      return NextResponse.json(
        { error: 'Yard sale not found' },
        { status: 404 }
      );
    }

    // Verify yard sale pincode matches user's pincode
    const normalizedYardSalePincode = yardSale.pincode.replace(/-/g, '').slice(0, 5);
    if (normalizedYardSalePincode !== normalizedUserPincode) {
      return NextResponse.json(
        { error: 'You can only view yard sales in your pincode area' },
        { status: 403 }
      );
    }

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
        createdAt: yardSale.createdAt,
        updatedAt: yardSale.updatedAt,
        isOwner: yardSale.createdBy._id.toString() === user._id.toString()
      }
    });
  } catch (error) {
    console.error('Error fetching yard sale:', error);
    return NextResponse.json(
      { error: 'Failed to fetch yard sale' },
      { status: 500 }
    );
  }
}

// PATCH - Update a yard sale (creator only)
export async function PATCH(request, { params }) {
  try {
    await connectDB();
    
    const { id } = await params;
    const body = await request.json();
    const { title, description, saleDate, saleTime, location, address, contactInfo, priceRange, images } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Yard sale ID is required' },
        { status: 400 }
      );
    }

    // Find the yard sale
    const yardSale = await YardSale.findById(id).populate('createdBy', 'firebaseUid');
    if (!yardSale) {
      return NextResponse.json(
        { error: 'Yard sale not found' },
        { status: 404 }
      );
    }

    // Verify authentication token
    const decodedToken = await verifyToken(request);
    if (!decodedToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing authentication token' },
        { status: 401 }
      );
    }

    // Get the MongoDB user
    const user = await User.findOne({ firebaseUid: decodedToken.uid });
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is the creator
    if (yardSale.createdBy._id.toString() !== user._id.toString()) {
      return NextResponse.json(
        { error: 'You are not authorized to edit this yard sale' },
        { status: 403 }
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

    // Normalize pincode
    const normalizedUserPincode = userPincode.replace(/-/g, '').slice(0, 5);

    // Build update object with only provided fields
    const updateData = {};

    if (title !== undefined) {
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return NextResponse.json(
          { error: 'Title is required' },
          { status: 400 }
        );
      }
      const sanitizedTitle = sanitizeText(title.trim());
      if (sanitizedTitle.length === 0) {
        return NextResponse.json(
          { error: 'Title cannot be empty after sanitization' },
          { status: 400 }
        );
      }
      if (sanitizedTitle.length < 3 || sanitizedTitle.length > 200) {
        return NextResponse.json(
          { error: 'Title must be between 3 and 200 characters' },
          { status: 400 }
        );
      }
      updateData.title = sanitizedTitle;
    }

    if (description !== undefined) {
      if (!description || typeof description !== 'string' || description.trim().length === 0) {
        return NextResponse.json(
          { error: 'Description is required' },
          { status: 400 }
        );
      }
      const sanitizedDescription = sanitizeText(description.trim());
      if (sanitizedDescription.length === 0) {
        return NextResponse.json(
          { error: 'Description cannot be empty after sanitization' },
          { status: 400 }
        );
      }
      if (sanitizedDescription.length < 10 || sanitizedDescription.length > 2000) {
        return NextResponse.json(
          { error: 'Description must be between 10 and 2000 characters' },
          { status: 400 }
        );
      }
      updateData.description = sanitizedDescription;
    }

    if (saleDate !== undefined) {
      const saleDateObj = new Date(saleDate);
      if (isNaN(saleDateObj.getTime())) {
        return NextResponse.json(
          { error: 'Invalid sale date' },
          { status: 400 }
        );
      }
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
      updateData.saleDate = saleDateObj;
    }

    if (saleTime !== undefined) {
      updateData.saleTime = saleTime ? saleTime.trim() : null;
    }

    if (address !== undefined) {
      if (!address || typeof address !== 'string' || address.trim().length === 0) {
        return NextResponse.json(
          { error: 'Address is required' },
          { status: 400 }
        );
      }
      const sanitizedAddress = sanitizeText(address.trim());
      if (sanitizedAddress.length === 0) {
        return NextResponse.json(
          { error: 'Address cannot be empty after sanitization' },
          { status: 400 }
        );
      }
      updateData.address = sanitizedAddress;
    }

    if (location !== undefined) {
      if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
        return NextResponse.json(
          { error: 'Valid location with lat and lng is required' },
          { status: 400 }
        );
      }
      if (location.lat < -90 || location.lat > 90 || location.lng < -180 || location.lng > 180) {
        return NextResponse.json(
          { error: 'Invalid location coordinates' },
          { status: 400 }
        );
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

      const normalizedLocationPincode = locationPincode.replace(/-/g, '').slice(0, 5);
      if (normalizedLocationPincode !== normalizedUserPincode) {
        return NextResponse.json(
          { error: `Selected location is not within your pincode (${userPincode}). You can only create yard sales in your pincode area.` },
          { status: 400 }
        );
      }

      updateData.location = {
        lat: location.lat,
        lng: location.lng
      };
      updateData.pincode = normalizedUserPincode;
    }

    if (contactInfo !== undefined) {
      updateData.contactInfo = contactInfo ? {
        phone: contactInfo.phone ? contactInfo.phone.trim() : null,
        email: contactInfo.email ? contactInfo.email.trim() : null
      } : null;
    }

    if (priceRange !== undefined) {
      updateData.priceRange = priceRange ? priceRange.trim() : null;
    }

    if (images !== undefined) {
      if (Array.isArray(images)) {
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
        updateData.images = images;
      }
    }

    // Update the yard sale
    const updatedYardSale = await YardSale.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firebaseUid firstName lastName photoURL');

    return NextResponse.json({
      success: true,
      yardSale: {
        _id: updatedYardSale._id,
        title: updatedYardSale.title,
        description: updatedYardSale.description,
        saleDate: updatedYardSale.saleDate,
        saleTime: updatedYardSale.saleTime,
        location: updatedYardSale.location,
        address: updatedYardSale.address,
        pincode: updatedYardSale.pincode,
        contactInfo: updatedYardSale.contactInfo,
        priceRange: updatedYardSale.priceRange,
        images: updatedYardSale.images,
        createdBy: {
          _id: updatedYardSale.createdBy._id,
          firebaseUid: updatedYardSale.createdBy.firebaseUid,
          name: `${updatedYardSale.createdBy.firstName} ${updatedYardSale.createdBy.lastName}`,
          photoURL: updatedYardSale.createdBy.photoURL
        },
        createdAt: updatedYardSale.createdAt,
        updatedAt: updatedYardSale.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating yard sale:', error);
    return NextResponse.json(
      { error: 'Failed to update yard sale' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a yard sale (creator only)
export async function DELETE(request, { params }) {
  try {
    await connectDB();
    
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Yard sale ID is required' },
        { status: 400 }
      );
    }

    // Find the yard sale
    const yardSale = await YardSale.findById(id).populate('createdBy', 'firebaseUid');
    if (!yardSale) {
      return NextResponse.json(
        { error: 'Yard sale not found' },
        { status: 404 }
      );
    }

    // Verify authentication token
    const decodedToken = await verifyToken(request);
    if (!decodedToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing authentication token' },
        { status: 401 }
      );
    }

    // Get the MongoDB user
    const user = await User.findOne({ firebaseUid: decodedToken.uid });
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is the creator
    if (yardSale.createdBy._id.toString() !== user._id.toString()) {
      return NextResponse.json(
        { error: 'You are not authorized to delete this yard sale' },
        { status: 403 }
      );
    }

    // Check if user is banned
    if (user.moderation?.banned === true) {
      return NextResponse.json(
        { error: 'Account is banned' },
        { status: 403 }
      );
    }

    // Delete the yard sale
    await YardSale.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: 'Yard sale deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting yard sale:', error);
    return NextResponse.json(
      { error: 'Failed to delete yard sale' },
      { status: 500 }
    );
  }
}

