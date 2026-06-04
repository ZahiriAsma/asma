import React, { useState, useEffect } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2, LayoutDashboard, BarChart3, BellRing, ClipboardCheck, LogIn, X, ArrowLeft } from 'lucide-react';
import api from '../api/axios';
import logo from '../assets/logo.png';
import cardBg from '../assets/login_bg.png';
import { useTranslation } from '../hooks/useTranslation';
import useMediaQuery from '../hooks/useMediaQuery';

/* ─────────────── Input style (light, like the image) ─────────────── */
const inputStyle = (focused) => ({
    width: '100%',
    boxSizing: 'border-box',
    background: 'rgba(255, 255, 255, 0.12)',
    border: `1.5px solid ${focused ? '#10b981' : 'rgba(255, 255, 255, 0.35)'}`,
    borderRadius: '10px',
    padding: '12px 14px 12px 42px',
    color: '#ffffff',
    fontSize: '14px',
    outline: 'none',
    transition: 'all 0.25s ease',
    backdropFilter: 'blur(4px)',
});

const labelStyle = {
    display: 'block',
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '0.13em',
    textTransform: 'uppercase',
    marginBottom: '7px',
};

/* ─────────────── Forgot Password Modal ─────────────── */
const ForgotModal = ({ onClose }) => {
    const { t, isRtl } = useTranslation();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [sent, setSent] = useState(false);
    const [focused, setFocused] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await api.post('/forgot-password', { email });
            setSent(true);
        } catch (err) {
            const data = err.response?.data;
            setError(data?.message || t('login.errorServer'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div dir={isRtl ? 'rtl' : 'ltr'} style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.82)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px', backdropFilter: 'blur(12px)',
        }}>
            <div style={{
                background: 'rgba(15, 25, 40, 0.98)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: '20px', padding: '36px 32px',
                width: '100%', maxWidth: '420px',
                boxSizing: 'border-box', position: 'relative',
                boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
                color: '#ffffff',
            }}>
                <button onClick={onClose} style={{
                    position: 'absolute', top: '16px', [isRtl ? 'left' : 'right']: '16px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px', padding: '6px', cursor: 'pointer',
                    color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center',
                    transition: 'all 0.2s',
                }}>
                    <X style={{ width: '16px', height: '16px' }} />
                </button>

                {sent ? (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <div style={{
                            width: '64px', height: '64px', margin: '0 auto 20px',
                            background: 'rgba(16,185,129,0.15)',
                            border: '2px solid #10b981', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Mail style={{ width: '28px', height: '28px', color: '#10b981' }} />
                        </div>
                        <h3 style={{ color: '#ffffff', fontSize: '20px', fontWeight: '700', margin: '0 0 10px' }}>
                            Email envoyé !
                        </h3>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: '1.6', margin: '0 0 8px' }}>
                            Un lien de réinitialisation a été envoyé à
                        </p>
                        <p style={{ color: '#10b981', fontWeight: '600', fontSize: '14px', margin: '0 0 24px' }}>
                            {email}
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', margin: '0 0 28px', lineHeight: '1.6' }}>
                            Vérifiez votre boîte de réception. Le lien expire dans <strong style={{ color: 'rgba(255,255,255,0.7)' }}>60 minutes</strong>.
                        </p>
                        <button onClick={onClose} style={{
                            background: 'linear-gradient(90deg, #059669, #10b981)',
                            border: 'none', borderRadius: '10px',
                            padding: '12px 32px', color: 'white',
                            fontWeight: '700', fontSize: '14px', cursor: 'pointer',
                            boxShadow: '0 4px 15px rgba(16,185,129,0.35)',
                        }}>
                            {t('reset.backToLogin')}
                        </button>
                    </div>
                ) : (
                    <>
                        <div style={{ marginBottom: '28px' }}>
                            <div style={{
                                width: '48px', height: '48px', marginBottom: '16px',
                                background: 'rgba(16,185,129,0.1)',
                                border: '1px solid rgba(16,185,129,0.3)', borderRadius: '14px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Mail style={{ width: '22px', height: '22px', color: '#10b981' }} />
                            </div>
                            <h3 style={{ color: '#ffffff', fontSize: '20px', fontWeight: '700', margin: '0 0 8px' }}>
                                {t('login.forgotPassword')}
                            </h3>
                            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0, lineHeight: '1.6' }}>
                                Entrez votre adresse email. Vous recevrez un lien pour créer un nouveau mot de passe.
                            </p>
                        </div>

                        {error && (
                            <div style={{
                                background: 'rgba(239,68,68,0.15)',
                                border: '1px solid rgba(239,68,68,0.4)',
                                borderRadius: '10px', padding: '10px 14px',
                                color: '#fca5a5', fontSize: '13px', marginBottom: '18px',
                            }}>
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>{t('common.email')}</label>
                                <div style={{ position: 'relative' }}>
                                    <Mail style={{
                                        position: 'absolute', [isRtl ? 'right' : 'left']: '13px', top: '50%',
                                        transform: 'translateY(-50%)', width: '17px', height: '17px',
                                        color: focused ? '#10b981' : 'rgba(255,255,255,0.4)',
                                        transition: 'color 0.2s',
                                    }} />
                                    <input
                                        type="email" value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="admin@gmail.com" required
                                        style={{...inputStyle(focused), paddingLeft: isRtl ? '14px' : '42px', paddingRight: isRtl ? '42px' : '14px'}}
                                        onFocus={() => setFocused(true)}
                                        onBlur={() => setFocused(false)}
                                    />
                                </div>
                            </div>

                            <button type="submit" disabled={loading} style={{
                                background: 'linear-gradient(90deg, #059669, #10b981)',
                                border: 'none', borderRadius: '10px',
                                padding: '13px', color: 'white',
                                fontWeight: '700', fontSize: '14px',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center',
                                justifyContent: 'center', gap: '8px',
                                opacity: loading ? 0.75 : 1,
                                boxShadow: '0 4px 15px rgba(16,185,129,0.3)',
                            }}>
                                {loading
                                    ? <Loader2 style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                                    : 'Envoyer le lien de réinitialisation'
                                }
                            </button>

                            <button type="button" onClick={onClose} style={{
                                background: 'none', border: 'none',
                                color: 'rgba(255,255,255,0.45)', cursor: 'pointer',
                                fontSize: '13px', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', gap: '6px',
                                transition: 'color 0.2s',
                            }}
                                onMouseEnter={(e) => e.currentTarget.style.color = '#10b981'}
                                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.45)'}>
                                <ArrowLeft style={{ width: '14px', height: '14px', transform: isRtl ? 'rotate(180deg)' : 'none' }} />
                                {t('reset.backToLogin')}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
};

/* ─────────────── Main Login Page ─────────────── */
const LoginPage = () => {
    const { t, lang, isRtl, isDark, setSysConfig, sysConfig } = useTranslation();
    const { isMobile, isTablet } = useMediaQuery();
    const isSmallScreen = isMobile || isTablet;
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [showForgot, setShowForgot] = useState(false);
    const [focused, setFocused] = useState('');

    useEffect(() => {
        // Sync document direction and theme for login page
        document.documentElement.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
        document.documentElement.setAttribute('lang', lang);
        if (isDark) {
            document.documentElement.classList.add('dark-theme');
            document.body.classList.add('dark-theme');
            document.documentElement.style.backgroundColor = '#0f172a';
            document.body.style.backgroundColor = '#0f172a';
        } else {
            document.documentElement.classList.remove('dark-theme');
            document.body.classList.remove('dark-theme');
            document.documentElement.style.backgroundColor = '#f8fafc';
            document.body.style.backgroundColor = '#f8fafc';
        }
    }, [isRtl, lang, isDark]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const response = await api.post('/login', { email, password });
            const { access_token, user } = response.data;
            const storage = rememberMe ? localStorage : sessionStorage;
            storage.setItem('auth_token', access_token);
            storage.setItem('user', JSON.stringify(user));
            setTimeout(() => { window.location.href = '/dashboard'; }, 800);
        } catch (err) {
            const data = err.response?.data;
            const msg = data?.message
                || (data?.errors ? Object.values(data.errors).flat()[0] : null)
                || t('login.errorInvalid');
            setError(msg);
            setLoading(false);
        }
    };

    const features = [
        { icon: <LayoutDashboard />, text: t('dashboard.stockManagement') },
        { icon: <ClipboardCheck />, text: t('dashboard.planMenus') },
        { icon: <BarChart3 />, text: t('dashboard.reportsFinancials') },
        { icon: <BellRing />, text: t('dashboard.stockAlerts') },
    ];

    const changeLanguage = (newLang) => {
        setSysConfig(prev => ({ ...prev, language: newLang }));
    };

    const toggleTheme = () => {
        setSysConfig(prev => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }));
    };

    return (
        <>
            {showForgot && <ForgotModal onClose={() => setShowForgot(false)} />}



            {/* ── Full-screen warehouse background ── */}
            <div style={{
                minHeight: '100vh',
                width: '100%',
                position: 'relative',
                backgroundImage: `url(${cardBg})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                display: 'flex',
                alignItems: 'center',
                fontFamily: isRtl ? "'Noto Sans Arabic', 'Segoe UI', sans-serif" : "'Inter', 'Segoe UI', sans-serif",
                overflow: 'hidden',
            }}>
                {/* Overlay — lighter so warehouse photo is visible */}
                <div style={{
                    position: 'absolute', inset: 0,
                    background: isDark
                        ? 'linear-gradient(100deg, rgba(2,6,23,0.92) 0%, rgba(2,6,23,0.85) 50%, rgba(2,6,23,0.60) 100%)'
                        : 'linear-gradient(100deg, rgba(5,15,28,0.78) 0%, rgba(5,15,28,0.55) 50%, rgba(5,15,28,0.22) 100%)',
                    zIndex: 1,
                    transition: 'all 0.3s ease',
                }} />

                {/* Content wrapper */}
                <div style={{
                    position: 'relative', zIndex: 2,
                    width: '100%', maxWidth: '1200px',
                    margin: '0 auto',
                    display: 'flex',
                    alignItems: isSmallScreen ? 'stretch' : 'center',
                    justifyContent: isSmallScreen ? 'center' : 'space-between',
                    gap: isMobile ? '24px' : '40px',
                    padding: isMobile ? '24px 16px' : isTablet ? '32px 24px' : '40px 48px',
                    boxSizing: 'border-box',
                    flexWrap: 'wrap',
                    flexDirection: isRtl ? 'row-reverse' : 'row',
                }}>

                    {/* ── LEFT: Branding & Features ── */}
                    <div style={{ flex: 1, minWidth: isMobile ? '100%' : '300px', color: '#ffffff', textAlign: isRtl ? 'right' : 'left' }}>

                        {/* Logo row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '44px', flexDirection: isRtl ? 'row-reverse' : 'row' }}>
                            <div style={{
                                width: '60px', height: '60px',
                                background: '#ffffff',
                                borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                                boxShadow: '0 0 0 3px rgba(16,185,129,0.35), 0 4px 16px rgba(0,0,0,0.3)',
                                overflow: 'hidden',
                                padding: '6px',
                            }}>
                                <img
                                    src={logo}
                                    alt="Logo"
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                />
                            </div>
                            <div>
                                <div style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff', lineHeight: 1.1 }}>
                                    {t('shell.brand')}
                                </div>
                                <div style={{
                                    fontSize: '10px', color: '#10b981', fontWeight: '700',
                                    letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: '2px',
                                }}>
                                    {t('shell.brandSub')}
                                </div>
                            </div>
                        </div>

                        {/* Main heading */}
                        <h1 style={{
                            fontSize: 'clamp(24px, 4vw, 44px)',
                            fontWeight: '800',
                            lineHeight: '1.2',
                            margin: '0 0 18px 0',
                            color: '#ffffff',
                        }}>
                            {isRtl ? (
                                <>
                                    إدارة المخزون <span style={{ color: '#10b981' }}>المبتكرة</span><br />لداخليات مؤسسات التكوين المهني
                                </>
                            ) : (
                                <>
                                    La gestion de stock<br />
                                    <span style={{ color: '#10b981' }}>réinventée</span> pour les internats
                                </>
                            )}
                        </h1>

                        {/* Subtitle */}
                        <p style={{
                            color: 'rgba(255,255,255,0.72)',
                            fontSize: '14.5px',
                            lineHeight: '1.7',
                            margin: '0 0 38px 0',
                            maxWidth: '440px',
                            marginLeft: isRtl ? 'auto' : '0',
                            marginRight: isRtl ? '0' : 'auto',
                        }}>
                            {isRtl
                                ? "تتبع وإدارة الصفقات والمخازن والموردين والوجبات اليومية عبر واجهة مستخدم حديثة وبسيطة وسريعة الاستجابة."
                                : "Pilotez vos marchés, stocks, fournisseurs et menus journaliers depuis une interface moderne, intuitive et centralisée."
                            }
                        </p>

                        {/* Feature list */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {features.map((f, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', flexDirection: isRtl ? 'row-reverse' : 'row' }}>
                                    <div style={{
                                        width: '34px', height: '34px', flexShrink: 0,
                                        background: 'rgba(16,185,129,0.18)',
                                        border: '1px solid rgba(16,185,129,0.35)',
                                        borderRadius: '8px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        {React.cloneElement(f.icon, {
                                            style: { width: '15px', height: '15px', color: '#10b981' }
                                        })}
                                    </div>
                                    <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13.5px', fontWeight: '500' }}>
                                        {f.text}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── RIGHT: Login Card (glassmorphism) ── */}
                    <div style={{
                        width: '100%',
                        maxWidth: '390px',
                        flexShrink: 0,
                        background: 'rgba(10, 20, 35, 0.76)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '18px',
                        padding: isMobile ? '24px 20px' : '36px 32px',
                        boxSizing: 'border-box',
                        backdropFilter: 'blur(22px)',
                        WebkitBackdropFilter: 'blur(22px)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                        color: '#ffffff',
                        textAlign: isRtl ? 'right' : 'left',
                    }}>
                        {/* Card header */}
                        <div style={{ marginBottom: '28px' }}>
                            <h2 style={{ color: '#ffffff', fontSize: '24px', fontWeight: '700', margin: '0 0 6px 0' }}>
                                {t('login.title')}
                            </h2>
                            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0 }}>
                                {t('login.subtitle')}
                            </p>
                        </div>

                        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

                            {/* Error banner */}
                            {error && (
                                <div style={{
                                    background: 'rgba(239,68,68,0.18)',
                                    border: '1px solid rgba(239,68,68,0.45)',
                                    borderRadius: '9px', padding: '10px 14px',
                                    color: '#fca5a5', fontSize: '13px',
                                }}>
                                    {error}
                                </div>
                            )}

                            {/* Email field */}
                            <div>
                                <label style={labelStyle}>{t('common.email')}</label>
                                <div style={{ position: 'relative' }}>
                                    <Mail style={{
                                        position: 'absolute', [isRtl ? 'right' : 'left']: '13px', top: '50%',
                                        transform: 'translateY(-50%)',
                                        width: '17px', height: '17px',
                                        color: focused === 'email' ? '#10b981' : 'rgba(255,255,255,0.45)',
                                        transition: 'color 0.2s',
                                        pointerEvents: 'none',
                                    }} />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="admin@ofppt.ma"
                                        required
                                        style={{
                                            ...inputStyle(focused === 'email'),
                                            paddingLeft: isRtl ? '14px' : '42px',
                                            paddingRight: isRtl ? '42px' : '14px'
                                        }}
                                        onFocus={() => setFocused('email')}
                                        onBlur={() => setFocused('')}
                                    />
                                </div>
                            </div>

                            {/* Password field */}
                            <div>
                                <label style={labelStyle}>{t('login.passwordPlaceholder')}</label>
                                <div style={{ position: 'relative' }}>
                                    <Lock style={{
                                        position: 'absolute', [isRtl ? 'right' : 'left']: '13px', top: '50%',
                                        transform: 'translateY(-50%)',
                                        width: '17px', height: '17px',
                                        color: focused === 'pwd' ? '#10b981' : 'rgba(255,255,255,0.45)',
                                        transition: 'color 0.2s',
                                        pointerEvents: 'none',
                                    }} />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        style={{
                                            ...inputStyle(focused === 'pwd'),
                                            paddingLeft: isRtl ? '44px' : '42px',
                                            paddingRight: isRtl ? '42px' : '44px',
                                        }}
                                        onFocus={() => setFocused('pwd')}
                                        onBlur={() => setFocused('')}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{
                                            position: 'absolute', [isRtl ? 'left' : 'right']: '13px', top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: 'rgba(255,255,255,0.45)', padding: 0,
                                            display: 'flex', transition: 'color 0.2s',
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.color = '#10b981'}
                                        onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.45)'}
                                    >
                                        {showPassword
                                            ? <EyeOff style={{ width: '17px', height: '17px' }} />
                                            : <Eye style={{ width: '17px', height: '17px' }} />
                                        }
                                    </button>
                                </div>
                            </div>

                            {/* Remember me + Forgot — same line like image */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', flexDirection: isRtl ? 'row-reverse' : 'row' }}>
                                <label style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    cursor: 'pointer', color: 'rgba(255,255,255,0.75)',
                                    userSelect: 'none',
                                    flexDirection: isRtl ? 'row-reverse' : 'row',
                                }}>
                                    <div
                                        onClick={() => setRememberMe(!rememberMe)}
                                        style={{
                                            width: '16px', height: '16px', flexShrink: 0,
                                            borderRadius: '4px',
                                            border: `2px solid ${rememberMe ? '#10b981' : 'rgba(255,255,255,0.3)'}`,
                                            background: rememberMe ? '#10b981' : 'transparent',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer', transition: 'all 0.2s',
                                        }}
                                    >
                                        {rememberMe && (
                                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        )}
                                    </div>
                                    <span onClick={() => setRememberMe(!rememberMe)}>{t('login.rememberMe')}</span>
                                </label>

                                <button
                                    type="button"
                                    onClick={() => setShowForgot(true)}
                                    style={{
                                        background: 'none', border: 'none',
                                        color: '#10b981', cursor: 'pointer',
                                        fontWeight: '600', fontSize: '13px', padding: 0,
                                        transition: 'opacity 0.2s',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.75'}
                                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                >
                                    {t('login.forgotPassword')}
                                </button>
                            </div>

                            {/* Submit button — green, full width */}
                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    background: 'linear-gradient(90deg, #059669 0%, #10b981 100%)',
                                    border: 'none', borderRadius: '10px',
                                    padding: '13px', color: 'white',
                                    fontSize: '15px', fontWeight: '700',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', gap: '9px',
                                    opacity: loading ? 0.8 : 1,
                                    transition: 'all 0.25s ease',
                                    boxShadow: '0 4px 20px rgba(16,185,129,0.4)',
                                    width: '100%',
                                    marginTop: '4px',
                                    flexDirection: isRtl ? 'row-reverse' : 'row',
                                }}
                                onMouseEnter={(e) => { if (!loading) e.currentTarget.style.boxShadow = '0 6px 28px rgba(16,185,129,0.55)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(16,185,129,0.4)'; }}
                            >
                                {loading
                                    ? <Loader2 style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} />
                                    : <><LogIn style={{ width: '18px', height: '18px', transform: isRtl ? 'rotate(180deg)' : 'none' }} /> {t('login.submit')}</>
                                }
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Arabic:wght@400;500;600;700;800&display=swap');
                @keyframes spin { to { transform: rotate(360deg); } }
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { margin: 0; transition: background-color 0.3s ease, color 0.3s ease; }
                input::placeholder { color: rgba(255,255,255,0.35) !important; }
                input:-webkit-autofill {
                    -webkit-box-shadow: 0 0 0 1000px rgba(10,20,35,0.9) inset !important;
                    -webkit-text-fill-color: #ffffff !important;
                }
            `}</style>
        </>
    );
};

export default LoginPage;
