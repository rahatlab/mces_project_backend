// Run this after Vercel deployment to make robelkhan2884@gmail.com admin
// node promote-admin.js

const BACKEND_URL = 'https://mces-project-backend.vercel.app';

async function promoteAdmin() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/promote-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'robelkhan2884@gmail.com',
        secretKey: 'mces_admin_promote_2026'
      })
    });

    const data = await response.json();
    console.log('Result:', data);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

promoteAdmin();
