'use client';

import { WebhookList } from '@/components/webhooks/webhook-list';

export default function WebhooksPage() {
  return (
    <div className="container mx-auto p-6">
      <WebhookList />
    </div>
  );
}