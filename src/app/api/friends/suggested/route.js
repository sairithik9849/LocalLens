// src/app/api/friends/suggested/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export async function GET(request) {
  try {
    await connectDB();
    
    const userId = request.headers.get('user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    // Find current user
    const currentUser = await User.findOne({ firebaseUid: userId });
    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const currentFriendIds = currentUser.friends || [];
    const currentPincode = currentUser.profile?.pincode;
    const currentCity = currentUser.profile?.city;

    // Find users in same location who are not friends
    const suggestions = await User.find({
      _id: { $ne: currentUser._id, $nin: currentFriendIds },
      $or: [
        { 'profile.pincode': currentPincode },
        { 'profile.city': currentCity }
      ],
      softDeleted: false
    })
      .select('firstName lastName photoURL email profile.city profile.pincode friends')
      .limit(10);

    // Format suggestions
    const formattedSuggestions = suggestions.map(user => {
      // Calculate mutual friends
      const mutualFriends = user.friends.filter(friendId =>
        currentFriendIds.some(id => id.toString() === friendId.toString())
      ).length;

      return {
        _id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        photoURL: user.photoURL,
        email: user.email,
        city: user.profile?.city,
        pincode: user.profile?.pincode,
        mutualFriends
      };
    });

    // Sort by mutual friends first, then by same pincode
    formattedSuggestions.sort((a, b) => {
      if (a.mutualFriends !== b.mutualFriends) {
        return b.mutualFriends - a.mutualFriends;
      }
      if (a.pincode === currentPincode && b.pincode !== currentPincode) {
        return -1;
      }
      if (b.pincode === currentPincode && a.pincode !== currentPincode) {
        return 1;
      }
      return 0;
    });

    return NextResponse.json({ suggestions: formattedSuggestions });
  } catch (error) {
    console.error('Error fetching suggested friends:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suggestions' },
      { status: 500 }
    );
  }
}