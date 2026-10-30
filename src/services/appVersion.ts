/** Derleme sırasında package.json'dan gömülür; tek kaynak budur. */
export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
/** Bu istemci en az hangi API sürümüyle çalışır (daha eski API'de uyarı verilir). */
export const MIN_API_VERSION = '1.0.0';
