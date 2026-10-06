import { useEffect, useRef, useState } from 'react';
import { api, HANDLE_PATTERN, normalizeHandle } from '../services';
import { closeAuthPrompt, useAuthPrompt, type AuthReason } from './auth';
import { useCommunity } from './store';
import { toast } from '../ui/common';
import * as I from '../ui/Icons';

/**
 * Connexion sans mot de passe, en une fenêtre : Google, ou e-mail + code à 6 chiffres.
 * Un nouveau compte confirme juste son nom et son pseudo, puis l'action en attente reprend.
 */

const HEADLINES: Record<AuthReason['kind'], string> = {
  publish: 'Create your account to publish',
  like: 'Sign in to like this loop',
  comment: 'Sign in to post your comment',
  report: 'Sign in to report this comment',
  download: 'Create a free account to keep downloading',
  signin: 'Welcome to Fourbar',
};

const SUBTITLES: Record<AuthReason['kind'], string> = {
  publish: 'Your loop goes live right after. It takes a few seconds.',
  like: 'It’s free and takes a few seconds.',
  comment: 'Your comment is kept and posted right after.',
  report: 'It’s free and takes a few seconds.',
  download: 'Free, unlimited downloads. Your download starts right after.',
  signin: 'Publish your loops, like and comment. Your drafts come with you.',
};

type Step = 'choose' | 'code' | 'profile';

export function SignInDialog() {
  const reason = useAuthPrompt((s) => s.reason);
  return reason ? <Dialog reason={reason} /> : null;
}

function Dialog({ reason }: { reason: AuthReason }) {
  const signIn = useCommunity((s) => s.signIn);
  const updateMe = useCommunity((s) => s.updateMe);
  const [step, setStep] = useState<Step>('choose');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [demoCode, setDemoCode] = useState<string | undefined>();
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [consent, setConsent] = useState(false);
  const [imported, setImported] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus();
  }, [step]);

  // Le profil d'un nouveau compte doit être confirmé (âge et conditions) : pas de fermeture à cette étape.
  const close = () => {
    if (step !== 'profile') closeAuthPrompt(false);
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const finish = (userName: string, drafts: number) => {
    toast(drafts > 0 ? `Welcome, ${userName}! ${drafts} draft${drafts > 1 ? 's' : ''} saved to your account.` : `Welcome, ${userName}!`);
    closeAuthPrompt(true);
  };

  const connected = async (method: Parameters<typeof signIn>[0]) => {
    const r = await signIn(method);
    if (r.isNew) {
      setName(r.user.name);
      setHandle(r.user.handle);
      setImported(r.importedDrafts);
      setStep('profile');
    } else finish(r.user.name, r.importedDrafts);
  };

  const title = reason.kind === 'publish' && reason.title.trim() ? `${HEADLINES.publish} “${reason.title.trim()}”` : HEADLINES[reason.kind];
  const handleOk = HANDLE_PATTERN.test(normalizeHandle(handle));

  return (
    <div className="modal-backdrop auth-backdrop" onMouseDown={close}>
      <div
        className="modal auth"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
        }}
      >
        {step !== 'profile' && (
          <button className="auth-close" onClick={close} aria-label="Close">
            <I.Close size={16} />
          </button>
        )}

        {step === 'choose' && (
          <>
            <h2 id="auth-title">{title}</h2>
            <p className="sub">{SUBTITLES[reason.kind]}</p>
            <button className="btn auth-google" disabled={busy} onClick={() => void run(() => connected({ provider: 'google' }))} autoFocus>
              <GoogleMark /> Continue with Google
            </button>
            <div className="auth-or">
              <span>or</span>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const r = await api.requestEmailCode(email);
                  setDemoCode(r.demoCode);
                  setCode('');
                  setStep('code');
                });
              }}
            >
              <input
                className="input auth-input"
                type="email"
                autoComplete="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button className="btn primary auth-wide" type="submit" disabled={busy || !email.trim()}>
                Continue with email
              </button>
            </form>
            <p className="auth-fine">No password needed. We’ll email you a 6-digit code.</p>
          </>
        )}

        {step === 'code' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => connected({ provider: 'email', email, code }));
            }}
          >
            <h2 id="auth-title">Check your email</h2>
            <p className="sub">
              We sent a 6-digit code to <b>{email.trim()}</b>.
            </p>
            <input
              ref={codeRef}
              className="input auth-input auth-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            {demoCode && <p className="auth-demo">Demo mode, no email is sent. Your code: {demoCode}</p>}
            <button className="btn primary auth-wide" type="submit" disabled={busy || code.length !== 6}>
              Continue
            </button>
            <div className="auth-links">
              <button type="button" onClick={() => setStep('choose')}>
                Use another email
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    setDemoCode((await api.requestEmailCode(email)).demoCode);
                    toast('New code sent');
                  })
                }
              >
                Send a new code
              </button>
            </div>
          </form>
        )}

        {step === 'profile' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await updateMe({ name, handle });
                finish(name.trim() || 'there', imported);
              });
            }}
          >
            <h2 id="auth-title">Almost there</h2>
            <p className="sub">This is how others will see you. You can change it later.</p>
            <div className="field">
              <span className="label">Name</span>
              <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="field">
              <span className="label">Username</span>
              <div className="auth-handle">
                <span>@</span>
                <input className="input" value={handle} maxLength={20} onChange={(e) => setHandle(normalizeHandle(e.target.value))} />
              </div>
            </div>
            <label className="check auth-consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>I’m 15 or older and I accept the Terms of Use and the Privacy Policy.</span>
            </label>
            <button className="btn primary auth-wide" type="submit" disabled={busy || !consent || !name.trim() || !handleOk}>
              {reason.kind === 'publish' ? 'Publish my loop' : 'Continue'}
            </button>
          </form>
        )}

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
