import { describe, it, expect, beforeEach } from 'vitest';
import { freshServices } from './helpers/browserStub';

describe('kullanıcılar ve yetkiler', () => {
  let ds: any;
  let ROLE_PERMISSIONS: any;
  beforeEach(async () => {
    ({ ds } = await freshServices());
    ROLE_PERMISSIONS = (await import('../src/services/dataService')).ROLE_PERMISSIONS;
  });

  const make = (role: string, extra: any = {}) => ds.saveUser({
    username: role.toLowerCase() + Math.random().toString(36).slice(2, 5),
    fullName: role,
    password: 'x',
    role,
    permissions: [...(ROLE_PERMISSIONS[role]?.permissions || [])],
    isActive: true,
    ...extra,
  });

  it('VARSAYILAN HESAP YOK: temiz kurulumda kullanıcı listesi boş (admin/1 gibi hesaplar yok)', () => {
    expect(ds.getUsers()).toEqual([]);
    expect(ds.hasUsers()).toBe(false);
    expect(ds.getCurrentUser().id).toBe('none');
  });

  it('oturum yokken hiçbir yetki verilmez', () => {
    expect(ds.hasPermission('POS_CANCEL')).toBe(false);
    expect(ds.hasPermission('REPORTS_VIEW')).toBe(false);
  });

  it('yönetici her şeyi yapabilir', () => {
    ds.setCurrentUser(make('ADMIN'));
    for (const p of ['POS_CANCEL', 'USERS_MANAGE', 'SETTINGS_MANAGE', 'REPORTS_VIEW', 'HERHANGI_BIR_IZIN']) expect(ds.hasPermission(p), p).toBe(true);
  });

  it('kasiyer: tahsilat var; iptal/ikram, ayarlar, kullanıcı yönetimi, rapor YOK', () => {
    ds.setCurrentUser(make('CASHIER'));
    expect(ds.hasPermission('POS_PAYMENT')).toBe(true);
    for (const p of ['POS_CANCEL', 'SETTINGS_MANAGE', 'USERS_MANAGE', 'REPORTS_VIEW', 'EXPENSES_MANAGE']) expect(ds.hasPermission(p), p).toBe(false);
  });

  it('kasiyere yönetici tek tek iptal izni verirse çalışır', () => {
    ds.setCurrentUser(make('CASHIER', { permissions: [...ROLE_PERMISSIONS.CASHIER.permissions, 'POS_CANCEL'] }));
    expect(ds.hasPermission('POS_CANCEL')).toBe(true);
  });

  it('pasif kullanıcının hiçbir yetkisi yoktur', () => {
    ds.setCurrentUser(make('ADMIN', { isActive: false }));
    expect(ds.hasPermission('POS_CANCEL')).toBe(false);
  });

  it('muhasebe: rapor+gider var, ayar/kullanıcı yok', () => {
    ds.setCurrentUser(make('ACCOUNTANT'));
    expect(ds.hasPermission('REPORTS_VIEW')).toBe(true);
    expect(ds.hasPermission('EXPENSES_MANAGE')).toBe(true);
    expect(ds.hasPermission('SETTINGS_MANAGE')).toBe(false);
    expect(ds.hasPermission('USERS_MANAGE')).toBe(false);
  });

  it('son aktif yönetici silinemez; ikinci yönetici varsa silinebilir', () => {
    const a1 = make('ADMIN');
    make('CASHIER');
    expect(ds.deleteUser(a1.id)).toBe(false);
    const a2 = make('ADMIN');
    expect(ds.deleteUser(a1.id)).toBe(true);
    expect(ds.getUsers().some((u: any) => u.id === a2.id)).toBe(true);
  });

  it('tek kullanıcı varsa silinemez', () => {
    const u = make('ADMIN');
    expect(ds.deleteUser(u.id)).toBe(false);
  });
});
