import { PrismaClient } from '@prisma/client'

/**
 * El cliente de Prisma se crea aquí y se **inyecta** en el servidor en vez de
 * importarse como singleton desde cada ruta. Es lo que permite que los tests
 * levanten la API entera apuntando a otra base de datos sin tocar el código.
 */
export function crearPrisma(url?: string): PrismaClient {
  return url ? new PrismaClient({ datasourceUrl: url }) : new PrismaClient()
}
