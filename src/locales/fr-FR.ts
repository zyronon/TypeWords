import i18nData from './i18n.json';

const FR = Object.entries(i18nData).reduce((result, current) => {
  const [key, value] = current;
  if (value.fr) {
    result[key] = value.fr;
  }
  return result;
}, {} as any);

export default FR;
