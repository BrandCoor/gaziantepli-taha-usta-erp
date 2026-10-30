import { describe, it, expect } from 'vitest';
import { mergeById, fillIfEmpty, safeParseArray } from '../src/services/syncMerge';

describe('syncMerge', () => {
  it('mergeById yerel kayıtları korur, yalnızca eksik uzak kayıtları ekler', () => {
    const local = [{ id: 'a', v: 'yerel' }, { id: 'b', v: 'yerel' }];
    const remote = [{ id: 'a', v: 'bulut' }, { id: 'c', v: 'bulut' }];
    const m = mergeById(local, remote);
    expect(m.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(m.find((x) => x.id === 'a')!.v).toBe('yerel'); // yerel ezilmez
  });
  it('bulut daha az kayıt içerse bile yerelden hiçbir kayıt kaybolmaz', () => {
    const local = [{ id: '1' }, { id: '2' }, { id: '3' }];
    expect(mergeById(local, [{ id: '1' }])).toHaveLength(3);
    expect(mergeById(local, [])).toHaveLength(3);
  });
  it('mergeById tekrarlı uzak kimlikleri bir kez ekler', () => {
    expect(mergeById([], [{ id: 'x' }, { id: 'x' }])).toHaveLength(1);
  });
  it('fillIfEmpty yalnızca yerel boşsa bulutu kullanır', () => {
    expect(fillIfEmpty([], [1, 2])).toEqual([1, 2]);
    expect(fillIfEmpty([9], [1, 2])).toEqual([9]);
  });
  it('safeParseArray bozuk/boş veriyle çökmez', () => {
    expect(safeParseArray(null)).toEqual([]);
    expect(safeParseArray('{bozuk')).toEqual([]);
    expect(safeParseArray('{"a":1}')).toEqual([]);
    expect(safeParseArray('[1]')).toEqual([1]);
  });
});
