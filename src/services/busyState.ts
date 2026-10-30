/** Güvenli yeniden başlatma kararı için: ödeme penceresi vb. açıkken güncelleme KURULMAZ. */
let paymentBusy = false;
export const setPaymentBusy = (v: boolean) => { paymentBusy = v; };
export const isPaymentBusy = () => paymentBusy;
