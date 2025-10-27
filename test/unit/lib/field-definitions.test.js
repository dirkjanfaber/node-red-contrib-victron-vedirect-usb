const { fieldDefinitions, getFieldDefinition } = require('../../../src/lib/field-definitions')

describe('field-definitions', () => {
  describe('fieldDefinitions object', () => {
    test('should contain voltage fields', () => {
      expect(fieldDefinitions.V).toEqual({
        description: 'Main or channel 1 (battery) voltage',
        units: 'mV'
      })
      expect(fieldDefinitions.VPV).toEqual({
        description: 'Panel voltage',
        units: 'mV'
      })
    })

    test('should contain current fields', () => {
      expect(fieldDefinitions.I).toEqual({
        description: 'Main or channel 1 battery current',
        units: 'mA'
      })
      expect(fieldDefinitions.IL).toEqual({
        description: 'Load current',
        units: 'mA'
      })
    })

    test('should contain power fields', () => {
      expect(fieldDefinitions.P).toEqual({
        description: 'Instantaneous power',
        units: 'W'
      })
      expect(fieldDefinitions.PPV).toEqual({
        description: 'Panel power',
        units: 'W'
      })
    })

    test('should contain historical data fields', () => {
      expect(fieldDefinitions.H1).toEqual({
        description: 'Depth of the deepest discharge',
        units: 'mAh'
      })
      expect(fieldDefinitions.H20).toEqual({
        description: 'Yield today',
        units: '0.01 kWh'
      })
    })

    test('should contain status fields', () => {
      expect(fieldDefinitions.CS).toEqual({
        description: 'State of operation',
        units: ''
      })
      expect(fieldDefinitions.ERR).toEqual({
        description: 'Error code',
        units: ''
      })
    })

    test('should contain device info fields', () => {
      expect(fieldDefinitions.PID).toEqual({
        description: 'ProductID',
        units: ''
      })
      expect(fieldDefinitions['SER#']).toEqual({
        description: 'Serial number',
        units: ''
      })
    })
  })

  describe('getFieldDefinition', () => {
    test('should return definition for known field', () => {
      const definition = getFieldDefinition('V')
      expect(definition).toEqual({
        description: 'Main or channel 1 (battery) voltage',
        units: 'mV'
      })
    })

    test('should return default definition for unknown field', () => {
      const definition = getFieldDefinition('UNKNOWN_FIELD')
      expect(definition).toEqual({
        description: 'Non implemented key',
        units: ''
      })
    })

    test('should handle special characters in field names', () => {
      const definition = getFieldDefinition('SER#')
      expect(definition).toEqual({
        description: 'Serial number',
        units: ''
      })
    })

    test('should handle empty string', () => {
      const definition = getFieldDefinition('')
      expect(definition).toEqual({
        description: 'Non implemented key',
        units: ''
      })
    })

    test('should be case-sensitive', () => {
      const upperDef = getFieldDefinition('V')
      const lowerDef = getFieldDefinition('v')

      expect(upperDef.description).toBe('Main or channel 1 (battery) voltage')
      expect(lowerDef.description).toBe('Non implemented key')
    })
  })
})
