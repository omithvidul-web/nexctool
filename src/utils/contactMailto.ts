export const CONTACT_EMAIL = 'omithvidul@gmail.com';

export interface ContactMessageInput {
  name: string;
  email: string;
  message: string;
}

export function buildContactSubject(name: string): string {
  return `New Message from NexcTool - ${name.trim()}`;
}

export function buildContactBody({ name, email, message }: ContactMessageInput): string {
  return `Name: ${name.trim()}\nEmail: ${email.trim()}\nMessage: ${message.trim()}`;
}

export function buildContactMailtoUrl(input: ContactMessageInput): string {
  const subject = encodeURIComponent(buildContactSubject(input.name));
  const body = encodeURIComponent(buildContactBody(input));
  return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
}

export function buildGmailComposeUrl(input: ContactMessageInput): string {
  const su = encodeURIComponent(buildContactSubject(input.name));
  const body = encodeURIComponent(buildContactBody(input));
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(CONTACT_EMAIL)}&su=${su}&body=${body}`;
}
