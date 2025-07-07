const axios = require('axios');

const {
  AIRTABLE_TOKEN,
  AIRTABLE_BASE_ID,
  AIRTABLE_USERS_TABLE,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

const SUPABASE_VIEW = 'profiles_with_departments';

// Format ISO date to Airtable's YYYY-MM-DD
function formatAirtableDate(dateString) {
  try {
    return new Date(dateString).toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

async function fetchSupabaseUsers() {
  try {
    const { data } = await axios.get(
      `${SUPABASE_URL}/rest/v1/${SUPABASE_VIEW}?select=profile_id,first_name,surname,email,tier,profile_created_at,department_name`,
      {
        headers: {
          apiKey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`✅ Fetched ${data.length} user(s) from Supabase view`);
    return data;
  } catch (err) {
    console.error('❌ Failed to fetch users from Supabase:', err.response?.data || err.message);
    return [];
  }
}

async function pushToAirtable(users) {
  for (const user of users) {
    const fullName = [user.first_name, user.surname].filter(Boolean).join(' ') || user.email || '';
    const isEnterprise = user.tier?.toLowerCase() === 'enterprise';

    const payload = {
      fields: {
        'Full Name': fullName,
        'Email': user.email || '',
        'Supabase UID': user.profile_id || '',
        'Enterprise Access': isEnterprise,
        'Select': 'Pending',
        'Created At': formatAirtableDate(user.profile_created_at),
        'Department': user.department_name || '',
        'Notes': ''
      }
    };

    try {
      const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_USERS_TABLE}?filterByFormula={Supabase UID}="${user.profile_id}"`;

      const searchRes = await axios.get(searchUrl, {
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
      });

      if (searchRes.data.records.length > 0) {
        const recordId = searchRes.data.records[0].id;

        await axios.patch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_USERS_TABLE}/${recordId}`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${AIRTABLE_TOKEN}`,
              'Content-Type': 'application/json',
            },
          }
        );
        console.log(`🔁 Updated Airtable record: ${recordId} for ${user.email}`);
      } else {
        const res = await axios.post(
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_USERS_TABLE}`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${AIRTABLE_TOKEN}`,
              'Content-Type': 'application/json',
            },
          }
        );
        console.log(`✅ Created new Airtable record: ${res.data.id} for ${user.email}`);
      }
    } catch (err) {
      console.error(`❌ Failed to sync ${user.email} to Airtable.`);
      console.error('📛 Error details:', JSON.stringify(err.response?.data || err.message, null, 2));
    }
  }
}

(async () => {
  const users = await fetchSupabaseUsers();
  if (users.length === 0) {
    console.log('⚠️ No users to sync.');
    return;
  }
  await pushToAirtable(users);
})();
