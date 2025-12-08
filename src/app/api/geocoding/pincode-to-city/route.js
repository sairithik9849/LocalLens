import { validatePincode } from '@/lib/pincodeValidation.js';
import { pincodeToCityAuto } from '@/lib/geocoding.js';

/**
 * GET /api/geocoding/pincode-to-city
 * Gets city name from pincode (US ZIP code)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const pincode = searchParams.get('pincode');

    if (!pincode) {
      return Response.json(
        { error: 'Pincode parameter is required' },
        { status: 400 }
      );
    }

    // Validate pincode format
    const validation = validatePincode(pincode);
    if (!validation.isValid) {
      return Response.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Get city from pincode
    const city = await pincodeToCityAuto(validation.formatted);

    if (!city) {
      return Response.json(
        { error: 'City not found for this pincode. Please enter manually.' },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      city: city,
      pincode: validation.formatted
    });

  } catch (error) {
    console.error('Error getting city from pincode:', error);
    return Response.json(
      {
        error: 'Failed to get city from pincode',
        message: error.message
      },
      { status: 500 }
    );
  }
}

