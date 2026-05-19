import { apiFetch, parseApiError } from './core';

export type SubmitFeedbackInput = {
  comment: string;
  screenshots: File[];
  pageUrl: string;
  viewport: string;
  userAgent: string;
};

export async function submitFeedback(input: SubmitFeedbackInput): Promise<void> {
  const form = new FormData();
  form.append('comment', input.comment);
  form.append('page_url', input.pageUrl);
  form.append('viewport', input.viewport);
  form.append('user_agent', input.userAgent);
  for (const file of input.screenshots) {
    form.append('screenshots', file, file.name);
  }
  const response = await apiFetch('/feedback', { method: 'POST', body: form }, true);
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}
