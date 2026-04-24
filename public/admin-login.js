const API_URL = window.location.origin;

document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    const button = document.querySelector('#login-form button[type="submit"]');
    const buttonText = document.getElementById('button-text');
    const errorMessage = document.getElementById('error-message');

    if (errorMessage) errorMessage.classList.add('hidden');

    if (button) button.disabled = true;
    if (buttonText) buttonText.textContent = 'Authenticating...';

    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Invalid credentials');
        }

        if (data.user.role !== "admin") {
            throw new Error("Not an admin account");
        }

        // ✅ SAVE TOKEN + EXPIRY HERE
        sessionStorage.setItem('adminToken', data.token);
        sessionStorage.setItem(
            'adminExpiry',
            new Date().getTime() + (30 * 60 * 1000) // 30 minutes
        );

        window.location.replace('admin-dashboard.html');

    } catch (error) {
        console.error('Login error:', error);

        if (errorMessage) {
            errorMessage.textContent = error.message;
            errorMessage.classList.remove('hidden');
        }

    } finally {
        if (button) button.disabled = false;
        if (buttonText) buttonText.textContent = 'Login';
    }
});
