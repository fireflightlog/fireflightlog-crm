const axios = require('axios');

const {
  AIRTABLE_TOKEN,
  AIRTABLE_BASE_ID,
  AIRTABLE_USERS_TABLE,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_USERS_TABLE
} = process.env;

async function fetchSupabaseUsers() {
  try {
    const { data } = await axios.get(`${SUPABASE_URL}/rest/v1/${SUPABASE_USERS_TABLE}`, {
      headers: {
        apiKey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    console.log(`✅ Fetched ${data.length} user(s) from Supabase`);
    console.log(data); // Log user data for debugging
    return data;
  } catch (err) {
    console.error('❌ Failed to fetch users from Supabase:', err.response?.data || err.message);
    return [];
  }
}

async function pushToAirtable(users) {
  for (const user of users) {
    const payload = {
      fields: {
        'Full Name': user.full_name || '',
        'Email': user.email || '',
        'Supabase UID': user.id || '',
        'Enterprise Access': false,
        'Onboarding Status': 'Pending',
        'Created At': user.created_at || new Date().toISOString(),
        'Notes': ''
      }
    };

    try {
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
      console.log(`✅ Created Airtable record: ${res.data.id} for ${user.email}`);
    } catch (err) {
      console.error(`❌ Failed to push ${user.email} to Airtable:`, err.response?.data || err.message);
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
