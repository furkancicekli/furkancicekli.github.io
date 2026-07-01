import type { Material, MaterialStore } from '../db/materials'

export function fakeMaterialStore(): MaterialStore & { materials: Material[] } {
  const materials: Material[] = []
  let nextId = 1

  function sortedMaterials(): Material[] {
    return [...materials].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    )
  }

  return {
    materials,
    async list(): Promise<Material[]> {
      return sortedMaterials().map((m) => ({ ...m }))
    },
    async create(name: string): Promise<Material> {
      const material: Material = { id: nextId++, name }
      materials.push(material)
      return { ...material }
    },
    async findByName(name: string): Promise<Material | null> {
      const found = materials.find((m) => m.name.toLowerCase() === name.toLowerCase())
      return found ? { ...found } : null
    },
  }
}
