import React, { useState } from 'react';
import { readAPIResponse } from '../services/api';
import { Button, Card, Field, Input, Notice, Segmented } from '../ui';
import { tr } from '../i18n';

type Feedback = { success: boolean; message: string } | null;

/** Changes the admin or panel password chosen at setup. Every other device of that workspace is signed out. */
export const PasswordSettings: React.FC = () => {
  const [workspace, setWorkspace] = useState<'admin' | 'panel'>('panel');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setFeedback(null);
    try {
      await readAPIResponse(await fetch('/api/auth/password', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace, currentPassword, newPassword })
      }));
      setCurrentPassword(''); setNewPassword('');
      setFeedback({ success: true, message: workspace === 'admin' ? tr('The admin password changed. Other devices signed in to the admin need the new password.') : tr('The panel password changed. Other devices signed in to the panel need the new password.') });
    } catch (error) {
      setFeedback({ success: false, message: error instanceof Error ? error.message : tr('The password could not be changed.') });
    } finally { setSaving(false); }
  };

  return (
    <Card title={tr('Sign-in')} description={tr('Change the password staff use for the daily panel, or your own admin password.')}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
        <Segmented label={tr('Password to change')} value={workspace} onChange={setWorkspace} options={[{ value: 'panel', label: tr('Panel password') }, { value: 'admin', label: tr('Admin password') }]} />
        <Field label={tr('Current admin password')}>{id => (
          <Input id={id} type="password" autoComplete="current-password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
        )}</Field>
        <Field label={workspace === 'admin' ? tr('New admin password') : tr('New panel password')} hint={tr('At least 10 characters, different from the other password.')}>{(id, hint) => (
          <Input id={id} aria-describedby={hint} type="password" autoComplete="new-password" required minLength={10} value={newPassword} onChange={e => setNewPassword(e.target.value)} />
        )}</Field>
        {feedback && <Notice tone={feedback.success ? 'positive' : 'danger'}>{feedback.message}</Notice>}
        <div><Button type="submit" loading={saving}>{saving ? tr('Saving…') : tr('Change password')}</Button></div>
      </form>
    </Card>
  );
};
