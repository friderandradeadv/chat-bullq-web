import { redirect } from 'next/navigation';

// Contatos agora é uma página própria em /contacts (sem o menu de Configurações
// do lado). Mantemos este redirect pra preservar links/bookmarks antigos.
export default function SettingsContactsRedirect() {
  redirect('/contacts');
}
