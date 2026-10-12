export const PROVINCE_EN: Record<string, string> = {
  'Oos-Kaap': 'Eastern Cape', Vrystaat: 'Free State', Gauteng: 'Gauteng', 'KwaZulu-Natal': 'KwaZulu-Natal',
  Limpopo: 'Limpopo', Mpumalanga: 'Mpumalanga', 'Noord-Kaap': 'Northern Cape', Noordwes: 'North West', 'Wes-Kaap': 'Western Cape',
};

/** Stored values stay Afrikaans; only the label changes. */
export const provinceLabel = (name: string, locale: string) => (locale === 'en' ? PROVINCE_EN[name] ?? name : name);
