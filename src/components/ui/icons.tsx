import type { SVGProps } from 'react';

/** Glifo do WhatsApp (monocromático — usa currentColor). */
export function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  );
}

/**
 * Ícone "nova conversa" do WhatsApp — balão de conversa (com cauda embaixo à
 * esquerda) e o canto superior direito aberto pra um lápis de "compor". Traço
 * (outline) pra combinar com os ícones lucide do toolbar.
 */
export function WhatsAppNewChatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Balão de conversa (canto sup. direito aberto pro lápis) */}
      <path d="M20 9.6V14a3 3 0 0 1-3 3H9.5L5.5 20v-3.1A3 3 0 0 1 4 14V8a3 3 0 0 1 3-3h6.7" />
      {/* Lápis (compor nova mensagem) */}
      <path d="M18.6 3.4 20.6 5.4 14 12l-2.7.7.7-2.7 6.6-6.6Z" />
    </svg>
  );
}

export function ZappfyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 50 45" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M9.476 36.599s-2.672.057-4.005-.012C2.239 36.42.083 34.344.055 31.096c-.073-8.511-.073-17.025 0-25.536C.083 2.18 2.269.052 5.7.039 18.439-.012 31.18-.014 43.917.039c3.517.013 5.634 2.215 5.657 5.793.053 8.333.053 16.665-.006 24.998-.028 3.684-2.186 5.739-5.971 5.762-7.8.043-15.599.014-23.428.014-2.092 4.831-5.368 8.383-10.557 8.394-1.706.005-2.922-.417-2.922-.417s2.916-1.322 3.925-3.615c1.202-2.731.454-4.351.454-4.351l-1.594-.018Z"
        fill="url(#zappfy_grad)"
      />
      <path
        d="M27.828 11.226h-8.823a4.226 4.226 0 0 1-4.228-4.223h20.331v4.223L21.655 24.896h9.327a4.226 4.226 0 0 1 4.228 4.223H14.41v-4.223l13.419-13.67Z"
        fill="#171D18"
      />
      <defs>
        <linearGradient id="zappfy_grad" x1="-10.158" y1="43.912" x2="51.345" y2="-1.247" gradientUnits="userSpaceOnUse">
          <stop stopColor="#51C26F" />
          <stop offset="1" stopColor="#F2E901" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function MetaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        fill="url(#meta_grad)"
        d="M18 1L21.62 4.48L26.5 3.28L27.9 8.1L32.72 9.5L31.52 14.38L35 18L31.52 21.62L32.72 26.5L27.9 27.9L26.5 32.72L21.62 31.52L18 35L14.38 31.52L9.5 32.72L8.1 27.9L3.28 26.5L4.48 21.62L1 18L4.48 14.38L3.28 9.5L8.1 8.1L9.5 3.28L14.38 4.48Z"
      />
      <path
        d="M11.5 18.5L16 23L25 13.5"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <defs>
        <linearGradient id="meta_grad" x1="18" y1="1" x2="18" y2="35" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1FB1FF" />
          <stop offset="1" stopColor="#0066E1" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="18" cy="18" r="18" fill="url(#ig_grad)" />
      <rect x="9.5" y="9.5" width="17" height="17" rx="5" stroke="white" strokeWidth="2.6" fill="none" />
      <circle cx="18" cy="18" r="4.4" stroke="white" strokeWidth="2.6" fill="none" />
      <circle cx="23.2" cy="12.8" r="1.15" fill="white" />
      <defs>
        <radialGradient id="ig_grad" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(7 38) rotate(-55) scale(48)">
          <stop stopColor="#FFD600" />
          <stop offset="0.25" stopColor="#FF7A00" />
          <stop offset="0.55" stopColor="#FF137C" />
          <stop offset="0.85" stopColor="#A02DAA" />
          <stop offset="1" stopColor="#5851DB" />
        </radialGradient>
      </defs>
    </svg>
  );
}
