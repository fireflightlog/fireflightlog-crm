const axios = require('axios');

const {
  AIRTABLE_TOKEN,
  AIRTABLE_BASE_ID,
  AIRTABLE_USERS_TABLE,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

const SUPABASE_VIEW = 'department_member_profiles_view';

async function fetchSupabaseUsers() {
  try {
    const { data } = await axios.get(
      `${SUPABASE_URL}/rest/v1/${SUPABASE_VIEW}?select=profile_id,first_name,surname,email,department_id,departments(name),created_at`,
      {
        headers: {
          apiKey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`✅ Fetched ${data.length} user(s) from Supabase view`);
    console.log('🔎 User data:', JSON.stringify(data, null, 2));
    return data;
  } catch (err) {
    console.error('❌ Failed to fetch users from Supabase:', err.response?.data || err.message);
    return [];
  }
}

// Use only the date portion, which works with or without "Include time" in Airtable
function formatAirtableDate(dateString) {
  try {
    return new Date(dateString).toISOString().split('T')[0]; // YYYY-MM-DD
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

async function pushToAirtable(users) {
  for (const user of users) {
    const fullName = [user.first_name, user.surname].filter(Boolean).join(' ') || user.email || '';
    const departmentName = user.departments?.name || '';

    const payload = {
      fields: {
        'Full Name': fullName,
        'Email': user.email || '',
        'Supabase UID': user.profile_id || '',
        'Enterprise Access': false,
        'Select': 'Pending',
        'Created At': formatAirtableDate(user.created_at),
        'Department': departmentName,
        'Notes': ''
      }
    };

    console.log('📤 Sending payload to Airtable:', JSON.stringify(payload, null, 2));

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
      console.log('📥 Airtable response:', JSON.stringify(res.data, null, 2));
    } catch (err) {
      console.error(`❌ Failed to push ${user.email} to Airtable.`);
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
