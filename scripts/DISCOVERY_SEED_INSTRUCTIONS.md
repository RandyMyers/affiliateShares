# Discovery Data Seed Instructions

This script creates discoverable affiliates with full discovery data for testing the Discovery & Recruitment features.

## What This Script Does

1. Creates 10 discoverable affiliate profiles with:
   - Categories (blogger, fashion, technology, etc.)
   - Website information
   - Traffic metrics (monthly visitors, page views, traffic sources)
   - Engagement metrics (social followers, engagement rates)
   - Network-wide statistics
   - Verification status and quality scores

2. **Important**: These affiliates are NOT associated with any merchant stores, so they will appear in the Discovery page

3. All affiliates have:
   - `discoverable: true`
   - `allowInvitations: true`
   - Empty `stores` array (no merchant associations)

## Usage

From the `server` directory, run:

```bash
node scripts/seedDiscoveryData.js
```

## Requirements

- MongoDB connection must be configured in `.env`
- The script will create new users if they don't exist
- Default password for all accounts: `password123`

## Affiliates Created

1. **techblogger** - Technology & Electronics blogger
2. **fashionista** - Fashion influencer
3. **healthguru** - Health & Wellness expert
4. **couponking** - Deals & Coupons site
5. **travelwanderer** - Travel blogger
6. **foodiechef** - Food & Recipe blogger
7. **fitnesspro** - Fitness coach
8. **homeimprover** - Home & Garden DIY
9. **financeexpert** - Finance advisor
10. **gamingstreamer** - Gaming content creator

## Testing the Discovery Feature

After running the script:

1. Log in to the Client (Merchant) app
2. Navigate to **Recruitment > Discover Affiliates** in the sidebar
3. You should see all 10 discoverable affiliates
4. Test features:
   - Search functionality
   - Category filtering
   - Advanced filters
   - View affiliate profiles
   - Create invitations
   - Add to baskets

## Notes

- The script will skip affiliates that already have discovery data
- To re-seed, the script will clear existing discovery affiliates (those with no store associations)
- Your existing affiliate (the one you created and seeded with merchant data) will NOT appear because it's already associated with a merchant store

## Verification

To verify the data was created correctly:

```javascript
// In MongoDB shell or Compass
db.affiliates.find({ 
  "discovery.discoverable": true,
  "stores": { $size: 0 }
}).count()
// Should return 10
```

