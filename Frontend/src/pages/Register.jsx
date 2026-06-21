import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config';
import '../styles/Dashboard.css';

const Register = () => {
    const [form, setForm] = useState({ email: '', firstname: '', lastname: '', password: '' });
    const [submitting, setSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const navigate = useNavigate();
    const [gisLoaded, setGisLoaded] = useState(false);

    useEffect(() => {
        const checkGis = setInterval(() => {
            if (window.google) {
                clearInterval(checkGis);
                setGisLoaded(true);
                window.google.accounts.id.initialize({
                    client_id: "788094254019-mockclientid.apps.googleusercontent.com",
                    callback: handleGoogleLogin
                });
                window.google.accounts.id.renderButton(
                    document.getElementById("google-signin-btn"),
                    { theme: "outline", size: "large", width: "240" }
                );
            }
        }, 300);
        return () => clearInterval(checkGis);
    }, []);

    async function handleGoogleLogin(response) {
        setSubmitting(true);
        setErrorMsg('');
        axios.post(`${API_URL}/api/auth/google-login`, {
            credential: response.credential
        }, {
            withCredentials: true
        }).then((res) => {
            navigate("/");
        }).catch((err) => {
            console.error(err);
            setErrorMsg(err.response?.data?.message || 'Google login failed.');
        }).finally(() => {
            setSubmitting(false);
        });
    }

    const handleMockGoogleLogin = () => {
        handleGoogleLogin({ credential: "mock_google_sso_token_12345" });
    };

    function handleChange(e) {
        const { name, value } = e.target;
        setForm(f => ({ ...f, [name]: value }));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitting(true);
        setErrorMsg('');

        if (!form.email || !form.firstname || !form.lastname || !form.password) {
            setErrorMsg("All fields are required");
            setSubmitting(false);
            return;
        }

        axios.post(`${API_URL}/api/auth/register`, {
            email: form.email,
            fullName: {
                firstName: form.firstname,
                lastName: form.lastname
            },
            password: form.password
        }, {
            withCredentials: true
        }).then((res) => {
            navigate("/");
        }).catch((err) => {
            console.error(err);
            setErrorMsg(err.response?.data?.message || 'Registration failed. Please try again.');
        }).finally(() => {
            setSubmitting(false);
        });
    }

    return (
        <div className="auth-container">
            <header className="auth-brand">
                <div className="auth-logo-wrapper">
                    <svg className="auth-logo-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 13l2 2 4-4" />
                    </svg>
                </div>
                <h1 className="auth-brand-name">Sahil Drive</h1>
                <p className="auth-brand-subtitle">The Future of AI-Powered Cloud Storage</p>
            </header>

            <div className="auth-glass-card" role="main">
                <h2 className="auth-card-title">Create Account</h2>
                <p className="auth-card-desc">Join us and start exploring your digital vault.</p>

                {errorMsg && (
                    <div style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1.25rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        {errorMsg}
                    </div>
                )}

                <form className="auth-form" onSubmit={handleSubmit} noValidate>
                    <div className="grid-2">
                        <div className="auth-input-group">
                            <label className="auth-input-label" htmlFor="firstname">First Name</label>
                            <div className="auth-input-wrapper">
                                <span className="auth-input-icon-left" style={{ left: '0.75rem' }}>
                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </span>
                                <input
                                    id="firstname"
                                    name="firstname"
                                    type="text"
                                    className="auth-input"
                                    style={{ paddingLeft: '2.5rem' }}
                                    placeholder=""
                                    value={form.firstname}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="auth-input-group">
                            <label className="auth-input-label" htmlFor="lastname">Last Name</label>
                            <div className="auth-input-wrapper">
                                <span className="auth-input-icon-left" style={{ left: '0.75rem' }}>
                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </span>
                                <input
                                    id="lastname"
                                    name="lastname"
                                    type="text"
                                    className="auth-input"
                                    style={{ paddingLeft: '2.5rem' }}
                                    placeholder=""
                                    value={form.lastname}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className="auth-input-group">
                        <label className="auth-input-label" htmlFor="email">Email Address</label>
                        <div className="auth-input-wrapper">
                            <span className="auth-input-icon-left">
                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" />
                                </svg>
                            </span>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                className="auth-input"
                                style={{ paddingLeft: '3rem' }}
                                placeholder=""
                                value={form.email}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="auth-input-group">
                        <label className="auth-input-label" htmlFor="password">Password</label>
                        <div className="auth-input-wrapper">
                            <span className="auth-input-icon-left">
                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </span>
                            <input
                                id="password"
                                name="password"
                                type={showPassword ? "text" : "password"}
                                className="auth-input"
                                style={{ paddingLeft: '3rem' }}
                                placeholder=""
                                value={form.password}
                                onChange={handleChange}
                                required
                                minLength={6}
                            />
                            <button
                                type="button"
                                className="auth-input-icon-right"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label="Toggle password visibility"
                            >
                                {showPassword ? (
                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                    </svg>
                                ) : (
                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="auth-submit-btn" disabled={submitting}>
                        {submitting ? 'Creating Account...' : 'Create Account'}
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </button>
                </form>

                <p className="auth-switch">
                    Already have an account? 
                    <Link to="/login" className="auth-switch-link">Sign in</Link>
                </p>

                <div className="auth-divider">Secure Registration</div>

                <div className="sso-buttons" style={{ flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
                    <div id="google-signin-btn" style={{ minHeight: '40px' }}></div>
                    <button type="button" className="sso-btn" onClick={handleMockGoogleLogin} style={{ width: '100%', justifyContent: 'center' }}>
                        <svg className="sso-icon" viewBox="0 0 24 24" width="16" height="16">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                        Mock Google SSO (Dev Fallback)
                    </button>
                </div>
            </div>

            <footer className="auth-footer">
                <div className="auth-footer-item">
                    <span className="status-dot"></span>
                    Systems Operational
                </div>
                <div className="auth-footer-item">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    AES-256 Encrypted
                </div>
            </footer>
        </div>
    );
};

export default Register;
