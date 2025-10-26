const { parseField, parseValues } = require('../../../src/lib/value-parser')

describe('value-parser', () => {
  describe('parseField', () => {
    test('should parse voltage field', () => {
      const result = parseField('V', '12450')
      expect(result).toEqual({
        value: 12450,
        description: 'Main or channel 1 (battery) voltage',
        units: 'mV'
      })
    })

    test('should parse current field', () => {
      const result = parseField('I', '1500')
      expect(result).toEqual({
        value: 1500,
        description: 'Main or channel 1 battery current',
        units: 'mA'
      })
    })

    test('should parse PID field with product name', () => {
      const result = parseField('PID', '0xA389')
      expect(result).toEqual({
        value: '0xA389',
        description: 'ProductID',
        units: '',
        product: 'SmartShunt 500A/50mV'
      })
    })

    test('should parse PID field without product name for unknown ID', () => {
      const result = parseField('PID', '0xFFFF')
      expect(result).toEqual({
        value: '0xFFFF',
        description: 'ProductID',
        units: ''
      })
    })

    test('should convert numeric strings to numbers', () => {
      expect(parseField('V', '12345').value).toBe(12345)
      expect(parseField('V', '0').value).toBe(0)
      expect(parseField('V', '-500').value).toBe(-500)
    })

    test('should handle decimal values', () => {
      const result = parseField('V', '12.5')
      expect(result.value).toBe(12.5)
    })

    test('should keep non-numeric strings as strings', () => {
      const result = parseField('SER#', 'HQ123456789')
      expect(result.value).toBe('HQ123456789')
    })

    test('should convert string "0" to number 0', () => {
      const result = parseField('I', '0')
      expect(result.value).toBe(0)
      expect(typeof result.value).toBe('number')
    })

    test('should handle unknown fields', () => {
      const result = parseField('UNKNOWN', 'value')
      expect(result).toEqual({
        value: 'value',
        description: 'Non implemented key',
        units: ''
      })
    })
  })

  describe('parseValues', () => {
    test('should parse complete frame', () => {
      const frame = {
        V: '12450',
        I: '1500',
        SOC: '850'
      }

      const result = parseValues(frame)

      expect(result.V).toEqual({
        value: 12450,
        description: 'Main or channel 1 (battery) voltage',
        units: 'mV'
      })
      expect(result.I).toEqual({
        value: 1500,
        description: 'Main or channel 1 battery current',
        units: 'mA'
      })
      expect(result.SOC).toEqual({
        value: 850,
        description: 'State-of-charge',
        units: '‰'
      })
    })

    test('should handle empty frame', () => {
      const result = parseValues({})
      expect(result).toEqual({})
    })

    test('should parse frame with PID', () => {
      const frame = {
        PID: '0xA389',
        V: '12800',
        I: '0'
      }

      const result = parseValues(frame)

      expect(result.PID).toEqual({
        value: '0xA389',
        description: 'ProductID',
        units: '',
        product: 'SmartShunt 500A/50mV'
      })
      expect(result.V.value).toBe(12800)
      expect(result.I.value).toBe(0)
    })

    test('should handle mixed numeric and string values', () => {
      const frame = {
        V: '12345',
        'SER#': 'HQ123456',
        FW: '159',
        CS: '3'
      }

      const result = parseValues(frame)

      expect(result.V.value).toBe(12345)
      expect(result['SER#'].value).toBe('HQ123456')
      expect(result.FW.value).toBe(159)
      expect(result.CS.value).toBe(3)
    })

    test('should handle negative values', () => {
      const frame = {
        I: '-1500',
        T: '-5'
      }

      const result = parseValues(frame)

      expect(result.I.value).toBe(-1500)
      expect(result.T.value).toBe(-5)
    })

    test('should preserve all fields from input', () => {
      const frame = {
        V: '12000',
        I: '500',
        SOC: '1000',
        T: '25'
      }

      const result = parseValues(frame)

      expect(Object.keys(result)).toEqual(Object.keys(frame))
    })
  })
})
