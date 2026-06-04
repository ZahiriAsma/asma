import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, Loader2, CheckCircle, ArrowLeft, ShieldCheck, Languages, Sun, Moon } from 'lucide-react';
import api from '../api/axios';
import logo from '../assets/logo.png';
import { useTranslation } from '../hooks/useTranslation';
import useMediaQuery from '../hooks/useMediaQuery';

const inputStyle = (focused) => ({
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(255, 255, 255, 0.05)',
    border: `1.5px solid ${focused ? '#10b981' : 'rgba(255, 255, 255, 0.15)'}`,
    borderRadius: '12px',
    padding: '13px 14px 13px 44px',
    color: '#ffffff', fontSize: '14px', outline: 'none',
    transition: 'all 0.25s ease',
});

const labelStyle = {
    display: 'block', color: 'rgba(255, 255, 255, 0.65)',
    fontSize: '11px', fontWeight: '700',
    letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px',
};

const ResetPasswordPage = () => {
    const { t, lang, isRtl, isDark, setSysConfig } = useTranslation();
    const { isMobile } = useMediaQuery();
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || '';
    const emailParam = params.get('email') || '';

    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [focused, setFocused] = useState('');

    useEffect(() => {
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

    const getStrength = (pwd) => {
        if (pwd.length === 0) return { level: 0, label: '', color: 'transparent' };
        if (pwd.length < 6) return { level: 1, label: t('reset.strengthWeak') || 'Trop court', color: '#ef4444' };
        if (pwd.length < 8 || !/[0-9]/.test(pwd)) return { level: 2, label: t('reset.strengthMedium') || 'Moyen', color: '#f59e0b' };
        if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd) && pwd.length >= 8) return { level: 3, label: t('reset.strengthStrong') || 'Fort', color: '#10b981' };
        return { level: 2, label: t('reset.strengthMedium') || 'Moyen', color: '#f59e0b' };
    };
    const strength = getStrength(password);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== passwordConfirm) {
            setError(t('reset.errorMatch') || 'Les mots de passe ne correspondent pas.');
            return;
        }
        if (password.length < 6) {
            setError(t('reset.errorMinLength') || 'Le mot de passe doit contenir au moins 6 caractères.');
            return;
        }

        setLoading(true);
        try {
            await api.post('/reset-password', {
                token,
                email: emailParam,
                password,
                password_confirmation: passwordConfirm,
            });
            setSuccess(true);
        } catch (err) {
            const data = err.response?.data;
            setError(data?.message || t('reset.errorInvalid') || 'Le lien est invalide ou expiré.');
        } finally {
            setLoading(false);
        }
    };

    const changeLanguage = (newLang) => {
        setSysConfig(prev => ({ ...prev, language: newLang }));
    };

    const toggleTheme = () => {
        setSysConfig(prev => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }));
    };

    return (
        <div dir={isRtl ? 'rtl' : 'ltr'} style={{
            minHeight: '100vh', width: '100%',
            background: isDark
                ? 'linear-gradient(135deg, #020617 0%, #0f172a 40%, #0f172a 70%, #020617 100%)'
                : 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #0f172a 70%, #020617 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: isRtl ? "'Noto Sans Arabic', 'Segoe UI', sans-serif" : "'Inter', 'Segoe UI', sans-serif",
            padding: '24px', boxSizing: 'border-box',
            position: 'relative',
        }}>
            {/* Floating Top Options Bar */}
            <div style={{
                position: 'absolute', top: '24px', [isRtl ? 'left' : 'right']: '24px',
                zIndex: 100, display: 'flex', alignItems: 'center', gap: '12px',
            }}>
                {/* Language Switcher */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: 'rgba(10, 20, 35, 0.65)', border: '1px solid rgba(255,255,255,0.12)',
                    padding: '6px 12px', borderRadius: '12px', backdropFilter: 'blur(10px)',
                }}>
                    <Languages size={15} color="#10b981" />
                    <select
                        value={lang}
                        onChange={(e) => changeLanguage(e.target.value)}
                        style={{
                            background: 'none', border: 'none', color: '#ffffff',
                            fontSize: '13px', fontWeight: '600', cursor: 'pointer', outline: 'none',
                        }}
                    >
                        <option value="fr" style={{ background: '#0f172a', color: '#fff' }}>FR</option>
                        <option value="ar" style={{ background: '#0f172a', color: '#fff' }}>AR</option>
                        <option value="en" style={{ background: '#0f172a', color: '#fff' }}>EN</option>
                    </select>
                </div>

                {/* Theme Switcher */}
                <button
                    onClick={toggleTheme}
                    style={{
                        background: 'rgba(10, 20, 35, 0.65)', border: '1px solid rgba(255,255,255,0.12)',
                        padding: '8px', borderRadius: '12px', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)',
                    }}
                >
                    {isDark ? <Sun size={15} color="#eab308" /> : <Moon size={15} color="#94a3b8" />}
                </button>
            </div>

            <div style={{ width: '100%', maxWidth: '420px' }}>
                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px', justifyContent: 'center', flexDirection: isRtl ? 'row-reverse' : 'row' }}>
                    <div style={{
                        width: '44px', height: '44px',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        borderRadius: '12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <img src={logo} alt="Logo" style={{ width: '24px', height: '24px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
                    </div>
                    <div style={{ textAlign: isRtl ? 'right' : 'left' }}>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: 'white' }}>{t('shell.brand')}</div>
                        <div style={{ fontSize: '10px', color: '#10b981', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{t('shell.brandSub')}</div>
                    </div>
                </div>

                {/* Card */}
                <div style={{
                    background: 'rgba(10, 20, 35, 0.76)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '24px', padding: isMobile ? '24px 20px' : '40px 36px',
                    boxSizing: 'border-box',
                    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                    textAlign: isRtl ? 'right' : 'left',
                }}>
                    {success ? (
                        /* ── Success ── */
                        <div style={{ textAlign: 'center', padding: '8px 0' }}>
                            <div style={{
                                width: '68px', height: '68px', margin: '0 auto 20px',
                                background: 'rgba(16,185,129,0.15)',
                                border: '2px solid #10b981', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <CheckCircle style={{ width: '32px', height: '32px', color: '#10b981' }} />
                            </div>
                            <h2 style={{ color: 'white', fontSize: '22px', fontWeight: '700', margin: '0 0 10px' }}>
                                {t('reset.successTitle') || 'Mot de passe mis à jour !'}
                            </h2>
                            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: '0 0 28px', lineHeight: '1.6' }}>
                                {t('reset.successDesc') || 'Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.'}
                            </p>
                            <button
                                onClick={() => window.location.href = '/'}
                                style={{
                                    background: 'linear-gradient(90deg, #059669, #10b981)',
                                    border: 'none', borderRadius: '12px',
                                    padding: '13px 32px', color: 'white',
                                    fontWeight: '700', fontSize: '15px', cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                                    flexDirection: isRtl ? 'row-reverse' : 'row',
                                }}
                            >
                                <ArrowLeft style={{ width: '16px', height: '16px', transform: isRtl ? 'rotate(180deg)' : 'none' }} />
                                {t('reset.backToLogin') || 'Se connecter'}
                            </button>
                        </div>
                    ) : (
                        /* ── Form ── */
                        <>
                            <div style={{ marginBottom: '28px' }}>
                                <div style={{
                                    width: '48px', height: '48px', marginBottom: '16px',
                                    background: 'rgba(16,185,129,0.1)',
                                    border: '1px solid rgba(16,185,129,0.3)', borderRadius: '14px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    margin: isRtl ? '0 0 16px auto' : '0 auto 16px 0',
                                }}>
                                    <ShieldCheck style={{ width: '22px', height: '22px', color: '#10b981' }} />
                                </div>
                                <h2 style={{ color: 'white', fontSize: '22px', fontWeight: '700', margin: '0 0 8px' }}>
                                    {t('reset.title') || 'Nouveau mot de passe'}
                                </h2>
                                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>
                                    {t('reset.subtitle') || 'Choisissez un mot de passe sécurisé pour '}{' '}
                                    <span style={{ color: '#10b981', fontWeight: '600' }}>{emailParam}</span>
                                </p>
                            </div>

                            {/* Invalid token warning */}
                            {!token && (
                                <div style={{
                                    background: 'rgba(239,68,68,0.1)',
                                    border: '1px solid rgba(239,68,68,0.35)',
                                    borderRadius: '10px', padding: '10px 14px',
                                    color: '#fca5a5', fontSize: '13px', marginBottom: '18px',
                                }}>
                                    ⚠️ {t('reset.errorInvalid') || 'Lien de réinitialisation invalide ou expiré.'}
                                </div>
                            )}

                            {error && (
                                <div style={{
                                    background: 'rgba(239,68,68,0.1)',
                                    border: '1px solid rgba(239,68,68,0.35)',
                                    borderRadius: '10px', padding: '10px 14px',
                                    color: '#fca5a5', fontSize: '13px', marginBottom: '18px',
                                }}>
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {/* New Password */}
                                <div>
                                    <label style={labelStyle}>{t('reset.newPassword') || 'Nouveau mot de passe'}</label>
                                    <div style={{ position: 'relative' }}>
                                        <Lock style={{ position: 'absolute', [isRtl ? 'right' : 'left']: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: focused === 'pwd' ? '#10b981' : 'rgba(255,255,255,0.3)', transition: 'color 0.2s' }} />
                                        <input
                                            type={showPassword ? 'text' : 'password'} value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            placeholder="••••••••" required
                                            style={{
                                                ...inputStyle(focused === 'pwd'),
                                                paddingLeft: isRtl ? '14px' : '44px',
                                                paddingRight: isRtl ? '44px' : '14px'
                                            }}
                                            onFocus={() => setFocused('pwd')}
                                            onBlur={() => setFocused('')}
                                        />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', [isRtl ? 'left' : 'right']: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 0, display: 'flex' }}>
                                            {showPassword ? <EyeOff style={{ width: '18px', height: '18px' }} /> : <Eye style={{ width: '18px', height: '18px' }} />}
                                        </button>
                                    </div>

                                    {/* Strength bar */}
                                    {password.length > 0 && (
                                        <div style={{ marginTop: '8px' }}>
                                            <div style={{ display: 'flex', gap: '4px', marginBottom: '4px', flexDirection: isRtl ? 'row-reverse' : 'row' }}>
                                                {[1, 2, 3].map(i => (
                                                    <div key={i} style={{
                                                        flex: 1, height: '3px', borderRadius: '99px',
                                                        background: i <= strength.level ? strength.color : 'rgba(255,255,255,0.1)',
                                                        transition: 'background 0.3s',
                                                    }} />
                                                ))}
                                            </div>
                                            <span style={{ fontSize: '11px', color: strength.color }}>{strength.label}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Confirm Password */}
                                <div>
                                    <label style={labelStyle}>{t('reset.confirmPassword') || 'Confirmer le mot de passe'}</label>
                                    <div style={{ position: 'relative' }}>
                                        <Lock style={{ position: 'absolute', [isRtl ? 'right' : 'left']: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: focused === 'confirm' ? '#10b981' : 'rgba(255,255,255,0.3)', transition: 'color 0.2s' }} />
                                        <input
                                            type={showConfirm ? 'text' : 'password'} value={passwordConfirm}
                                            onChange={e => setPasswordConfirm(e.target.value)}
                                            placeholder="••••••••" required
                                            style={{
                                                ...inputStyle(focused === 'confirm'),
                                                paddingLeft: isRtl ? '14px' : '44px',
                                                paddingRight: isRtl ? '44px' : '14px',
                                                borderColor: passwordConfirm && password !== passwordConfirm
                                                    ? '#ef4444'
                                                    : (focused === 'confirm' ? '#10b981' : 'rgba(255,255,255,0.15)'),
                                            }}
                                            onFocus={() => setFocused('confirm')}
                                            onBlur={() => setFocused('')}
                                        />
                                        <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ position: 'absolute', [isRtl ? 'left' : 'right']: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 0, display: 'flex' }}>
                                            {showConfirm ? <EyeOff style={{ width: '18px', height: '18px' }} /> : <Eye style={{ width: '18px', height: '18px' }} />}
                                        </button>
                                    </div>
                                    {passwordConfirm && password !== passwordConfirm && (
                                        <p style={{ color: '#ef4444', fontSize: '11px', marginTop: '6px' }}>
                                            ✗ {t('reset.errorMatch') || 'Les mots de passe ne correspondent pas'}
                                        </p>
                                    )}
                                    {passwordConfirm && password === passwordConfirm && password.length >= 6 && (
                                        <p style={{ color: '#10b981', fontSize: '11px', marginTop: '6px' }}>
                                            ✓ {t('reset.passwordsMatch') || 'Les mots de passe correspondent'}
                                        </p>
                                    )}
                                </div>

                                <button type="submit" disabled={loading || !token} style={{
                                    background: !token ? 'rgba(255,255,255,0.1)' : 'linear-gradient(90deg, #059669, #10b981)',
                                    border: 'none', borderRadius: '12px',
                                    padding: '14px', color: 'white',
                                    fontSize: '15px', fontWeight: '700',
                                    cursor: (loading || !token) ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', gap: '10px',
                                    opacity: loading ? 0.8 : 1,
                                    boxShadow: token ? '0 4px 15px rgba(16,185,129,0.3)' : 'none',
                                    flexDirection: isRtl ? 'row-reverse' : 'row',
                                }}>
                                    {loading
                                        ? <Loader2 style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} />
                                        : (t('reset.submit') || 'Réinitialiser le mot de passe')
                                    }
                                </button>

                                <button type="button" onClick={() => window.location.href = '/'} style={{
                                    background: 'none', border: 'none',
                                    color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
                                    fontSize: '13px', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    flexDirection: isRtl ? 'row-reverse' : 'row',
                                }}>
                                    <ArrowLeft style={{ width: '14px', height: '14px', transform: isRtl ? 'rotate(180deg)' : 'none' }} /> {t('reset.backToLogin') || 'Retour à la connexion'}
                                </button>
                            </form>
                        </>
                    )}
                </div>

                <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '11px', marginTop: '20px' }}>
                    InterNat Stock · OFPPT © 2026
                </p>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                input::placeholder { color: rgba(255,255,255,0.2); }
            `}</style>
        </div>
    );
};

export default ResetPasswordPage;
