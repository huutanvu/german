'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/lib/language-context';
import type { ProfessionReference } from '@/lib/types';

interface Profile {
  id?: string;
  display_name?: string;
  profession?: string;
  target_level?: string;
  preferred_language?: string;
}

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export default function ProfilePage() {
  const { t, setLanguage } = useLanguage();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [professions, setProfessions] = useState<ProfessionReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [profession, setProfession] = useState('software_engineer');
  const [targetLevel, setTargetLevel] = useState('B1');
  const [preferredLanguage, setPreferredLanguage] = useState<'en' | 'vi'>('en');

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [profileRes, professionsRes] = await Promise.all([
          fetch('/api/profile'),
          fetch('/api/professions'),
        ]);

        if (profileRes.ok) {
          const p: Profile = await profileRes.json();
          setProfile(p);
          setDisplayName(p.display_name ?? '');
          setProfession(p.profession ?? 'software_engineer');
          setTargetLevel(p.target_level ?? 'B1');
          setPreferredLanguage((p.preferred_language as 'en' | 'vi') ?? 'en');
        }

        if (professionsRes.ok) {
          const list: ProfessionReference[] = await professionsRes.json();
          setProfessions(list);
        }
      } catch {
        showToast('error', t('Failed to load profile.', 'Không thể tải hồ sơ.'));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [showToast, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName,
          profession,
          targetLevel,
          preferredLanguage,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? 'Request failed');
      }

      const updated: Profile = await res.json();
      setProfile(updated);
      
      // Instantly sync the UI language
      if (updated.preferred_language === 'en' || updated.preferred_language === 'vi') {
        setLanguage(updated.preferred_language as 'en' | 'vi');
      }

      showToast('success', t('Profile updated successfully.', 'Hồ sơ đã được cập nhật thành công.'));
    } catch (err) {
      showToast(
        'error',
        t('Failed to save profile.', 'Không thể lưu hồ sơ.') +
          (err instanceof Error ? ` ${err.message}` : '')
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile-page">
      {/* Toast */}
      {toast && (
        <div className={`profile-toast profile-toast--${toast.type}`} role="status">
          {toast.message}
        </div>
      )}

      <div className="profile-container">
        <header className="profile-header">
          <h1 className="profile-title">
            {t('User Profile', 'Hồ sơ người dùng')}
          </h1>
          <p className="profile-subtitle">
            {t(
              'Manage your learning profile, language preferences, and professional context.',
              'Quản lý hồ sơ học tập, tuỳ chọn ngôn ngữ và môi trường nghề nghiệp của bạn.'
            )}
          </p>
        </header>

        {loading ? (
          <div className="profile-skeleton">
            <div className="skeleton-field" />
            <div className="skeleton-field" />
            <div className="skeleton-field" />
            <div className="skeleton-field" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="profile-form">
            {/* Display Name */}
            <div className="profile-field">
              <label htmlFor="displayName" className="profile-label">
                {t('Display Name', 'Tên hiển thị')}
              </label>
              <input
                id="displayName"
                type="text"
                className="profile-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('Your name', 'Tên của bạn')}
                maxLength={80}
                autoComplete="off"
              />
            </div>

            {/* Preferred Language */}
            <div className="profile-field">
              <label htmlFor="preferredLanguage" className="profile-label">
                {t('Preferred Language', 'Ngôn ngữ ưu tiên')}
              </label>
              <select
                id="preferredLanguage"
                className="profile-select"
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value as 'en' | 'vi')}
              >
                <option value="en">English</option>
                <option value="vi">Tiếng Việt</option>
              </select>
            </div>

            {/* Profession */}
            <div className="profile-field">
              <label htmlFor="profession" className="profile-label">
                {t('Professional Context', 'Môi trường nghề nghiệp')}
              </label>
              <select
                id="profession"
                className="profile-select"
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
              >
                {professions.map((p) => (
                  <option key={p.id} value={p.slug}>
                    {p.displayName}
                  </option>
                ))}
              </select>
              {professions.find((p) => p.slug === profession) && (
                <p className="profile-hint">
                  {professions.find((p) => p.slug === profession)?.description}
                </p>
              )}
            </div>

            {/* Target Level */}
            <div className="profile-field">
              <label htmlFor="targetLevel" className="profile-label">
                {t('Target Level', 'Trình độ mục tiêu')}
              </label>
              <div className="profile-level-grid">
                {LEVELS.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    id={`level-${lvl}`}
                    className={`profile-level-btn${targetLevel === lvl ? ' profile-level-btn--active' : ''}`}
                    onClick={() => setTargetLevel(lvl)}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Sample Context Preview */}
            {professions.find((p) => p.slug === profession)?.sampleContext && (
              <div className="profile-preview">
                <span className="profile-preview-label">
                  {t('Sample context', 'Ngữ cảnh mẫu')}
                </span>
                <p className="profile-preview-text">
                  {professions.find((p) => p.slug === profession)?.sampleContext}
                </p>
              </div>
            )}

            <div className="profile-actions">
              <button
                type="submit"
                id="save-profile-btn"
                className="profile-save-btn"
                disabled={saving}
              >
                {saving
                  ? t('Saving…', 'Đang lưu…')
                  : t('Save Profile', 'Lưu hồ sơ')}
              </button>
            </div>
          </form>
        )}
      </div>

      <style>{`
        .profile-page {
          min-height: 100vh;
          padding: 2rem 1rem;
          position: relative;
        }

        .profile-container {
          max-width: 560px;
          margin: 0 auto;
        }

        /* ── Toast ─────────────────────────────────────── */
        .profile-toast {
          position: fixed;
          top: 1.25rem;
          right: 1.25rem;
          z-index: 9999;
          padding: 0.75rem 1.25rem;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          box-shadow: 0 4px 20px rgba(0,0,0,0.18);
          animation: toastIn 0.25s ease;
        }
        .profile-toast--success {
          background: #166534;
          color: #dcfce7;
          border: 1px solid #15803d;
        }
        .profile-toast--error {
          background: #7f1d1d;
          color: #fee2e2;
          border: 1px solid #991b1b;
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Header ─────────────────────────────────────── */
        .profile-header {
          margin-bottom: 2rem;
          padding-bottom: 1.25rem;
          border-bottom: 1px solid rgba(148,163,184,0.15);
        }
        .profile-title {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0 0 0.35rem;
          letter-spacing: -0.01em;
        }
        .profile-subtitle {
          font-size: 0.875rem;
          color: #94a3b8;
          margin: 0;
        }

        /* ── Skeleton ─────────────────────────────────── */
        .profile-skeleton {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .skeleton-field {
          height: 56px;
          border-radius: 8px;
          background: rgba(148,163,184,0.1);
          animation: shimmer 1.4s ease infinite;
        }
        @keyframes shimmer {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }

        /* ── Form ─────────────────────────────────────── */
        .profile-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .profile-field {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .profile-label {
          font-size: 0.8125rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #94a3b8;
        }

        .profile-input,
        .profile-select {
          width: 100%;
          padding: 0.6875rem 0.875rem;
          border-radius: 8px;
          border: 1px solid rgba(148,163,184,0.2);
          background: #ffffff;
          color: #171717;
          font-size: 0.9375rem;
          transition: border-color 0.18s, box-shadow 0.18s;
          outline: none;
          appearance: none;
        }
        .profile-select option {
          background-color: #ffffff;
          color: #171717;
        }

        .dark .profile-input,
        .dark .profile-select {
          background-color: #1e293b;
          border-color: rgba(148,163,184,0.15);
          color: #e2e8f0;
        }
        .dark .profile-select option {
          background-color: #1e293b;
          color: #e2e8f0;
        }

        .profile-input:focus,
        .profile-select:focus {
          border-color: rgba(99,102,241,0.55);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
        }
        .profile-select {
          cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.875rem center;
          padding-right: 2.5rem;
        }

        .profile-hint {
          font-size: 0.8rem;
          color: #64748b;
          margin: 0;
        }

        /* ── Level grid ─────────────────────────────────── */
        .profile-level-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 0.5rem;
        }
        .profile-level-btn {
          padding: 0.5rem 0;
          border-radius: 7px;
          border: 1px solid rgba(148,163,184,0.2);
          background: rgba(148,163,184,0.06);
          color: inherit;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: border-color 0.18s, background 0.18s, color 0.18s;
        }
        .profile-level-btn:hover {
          border-color: rgba(99,102,241,0.4);
          background: rgba(99,102,241,0.08);
        }
        .profile-level-btn--active {
          background: rgba(99,102,241,0.18);
          border-color: rgba(99,102,241,0.6);
          color: #818cf8;
        }

        /* ── Sample preview ─────────────────────────────── */
        .profile-preview {
          padding: 0.875rem 1rem;
          border-radius: 8px;
          border-left: 3px solid rgba(99,102,241,0.5);
          background: rgba(99,102,241,0.06);
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }
        .profile-preview-label {
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #818cf8;
        }
        .profile-preview-text {
          font-size: 0.875rem;
          color: #94a3b8;
          margin: 0;
          font-style: italic;
          line-height: 1.6;
        }

        /* ── Actions ─────────────────────────────────────── */
        .profile-actions {
          padding-top: 0.5rem;
        }
        .profile-save-btn {
          width: 100%;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          border: none;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: #fff;
          font-size: 0.9375rem;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.18s, transform 0.15s;
        }
        .profile-save-btn:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
        }
        .profile-save-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .profile-save-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
