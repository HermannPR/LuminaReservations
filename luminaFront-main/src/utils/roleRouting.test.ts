import { describe, expect, it } from 'vitest'
import { getRoleHomePath, isAdminRole, isGuardRole, normalizeRole } from './roleRouting'

describe('roleRouting', () => {
  it('normalizes roles before evaluating access', () => {
    expect(normalizeRole(' Guardia ')).toBe('guardia')
    expect(isGuardRole('GUARD')).toBe(true)
    expect(isGuardRole('guardia')).toBe(true)
    expect(isAdminRole('Administrador')).toBe(true)
  })

  it('routes guard users only to the guard page by default', () => {
    expect(getRoleHomePath('guardia')).toBe('/guardia')
    expect(getRoleHomePath('guard')).toBe('/guardia')
    expect(getRoleHomePath('employee')).toBe('/dashboard')
    expect(getRoleHomePath('admin')).toBe('/dashboard')
  })
})
