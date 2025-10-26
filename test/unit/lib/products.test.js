const { products, getProductName } = require('../../../src/lib/products')

describe('products', () => {
  describe('products object', () => {
    test('should contain BMV products', () => {
      expect(products['0x203']).toBe('BMV-700')
      expect(products['0x204']).toBe('BMV-702')
      expect(products['0x205']).toBe('BMV-700H')
    })

    test('should contain SmartSolar MPPT products', () => {
      expect(products['0xA050']).toBe('SmartSolar MPPT 250|100')
      expect(products['0xA053']).toBe('SmartSolar MPPT 75|15')
    })

    test('should contain BlueSolar MPPT products', () => {
      expect(products['0xA040']).toBe('BlueSolar MPPT 75|50')
      expect(products['0xA042']).toBe('BlueSolar MPPT 75|15')
    })

    test('should contain Phoenix Inverter products', () => {
      expect(products['0xA201']).toBe('Phoenix Inverter 12V 250VA 230V')
      expect(products['0xA291']).toBe('Phoenix Inverter 12V 2000VA 230V')
    })

    test('should contain SmartShunt products', () => {
      expect(products['0xA389']).toBe('SmartShunt 500A/50mV')
      expect(products['0xA38A']).toBe('SmartShunt 1000A/50mV')
      expect(products['0xA38B']).toBe('SmartShunt 2000A/50mV')
    })
  })

  describe('getProductName', () => {
    test('should return product name for valid product ID', () => {
      expect(getProductName('0xA389')).toBe('SmartShunt 500A/50mV')
      expect(getProductName('0x203')).toBe('BMV-700')
    })

    test('should return undefined for unknown product ID', () => {
      expect(getProductName('0xFFFF')).toBeUndefined()
      expect(getProductName('invalid')).toBeUndefined()
    })

    test('should handle empty string', () => {
      expect(getProductName('')).toBeUndefined()
    })

    test('should be case-sensitive', () => {
      expect(getProductName('0xa389')).toBeUndefined()
      expect(getProductName('0XA389')).toBeUndefined()
    })
  })
})
