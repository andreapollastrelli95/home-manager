import Dexie, { type Table } from 'dexie'
import { TABLES, type Row } from './data/model'

class HomeDB extends Dexie {
  expenses!: Table<any, number>
  deadlines!: Table<any, number>
  items!: Table<any, number>
  shopping!: Table<any, number>
  docs!: Table<any, number>
  vehicles!: Table<any, number>
  car_deadlines!: Table<any, number>
  car_services!: Table<any, number>
  car_expenses!: Table<any, number>
  car_fuel!: Table<any, number>
  car_docs!: Table<any, number>
  constructor() {
    super('home-manager') // il nome non cambia: i dati già salvati restano dove sono
    this.version(1).stores({
      expenses: '++id, categoria, data, scadenza',
      deadlines: '++id, data, tipo',
      items: '++id, stanza',
      shopping: '++id, preso',
      docs: '++id, tipo',
    })
    // versione 2: solo tabelle nuove per l'area Car, quelle di casa restano invariate
    this.version(2).stores({
      vehicles: '++id',
      car_deadlines: '++id, vehicle_id',
      car_services: '++id, vehicle_id',
      car_expenses: '++id, vehicle_id',
      car_fuel: '++id, vehicle_id',
      car_docs: '++id, vehicle_id',
    })
  }
}

export const db = new HomeDB()
export const dexieTables = () => TABLES.map((t) => db[t] as Table<Row, number>)

const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

export async function seedDemo() {
  if ((await db.expenses.count()) + (await db.deadlines.count()) > 0) return
  await db.expenses.bulkAdd([
    { descrizione: 'Bolletta luce', categoria: 'Luce', importo: 82.5, data: day(-10), scadenza: day(5), pagata: false },
    { descrizione: 'Bolletta gas', categoria: 'Gas', importo: 64.2, data: day(-20), scadenza: day(12), pagata: false },
    { descrizione: 'Internet fibra', categoria: 'Internet', importo: 29.9, data: day(-5), pagata: true },
  ])
  await db.deadlines.bulkAdd([
    { titolo: 'Revisione caldaia', tipo: 'Manutenzione', data: day(20), note: 'Chiamare il tecnico', fatto: false },
    { titolo: 'Pagamento IMU', tipo: 'Scadenza', data: day(8), note: '', fatto: false },
  ])
  await db.items.bulkAdd([
    { nome: 'Lavatrice', stanza: 'Bagno', quantita: 1, valore: 450, note: 'Garanzia fino al 2027' },
    { nome: 'Trapano', stanza: 'Garage', quantita: 1, valore: 80, note: '' },
  ])
  await db.shopping.bulkAdd([
    { nome: 'Latte', quantita: '2', preso: false },
    { nome: 'Detersivo piatti', quantita: '1', preso: false },
  ])
  await db.docs.bulkAdd([
    { titolo: 'Contratto di affitto', tipo: 'Contratto', link: 'C:\\Documenti\\affitto.pdf', scadenza: day(200), note: '' },
  ])
}

/** Auto di esempio, solo per la demo e una volta sola (chi la cancella non la vede ricomparire). */
export async function seedDemoCar() {
  const FLAG = 'home-manager-demo-auto'
  try { if (localStorage.getItem(FLAG)) return; localStorage.setItem(FLAG, '1') } catch { /* ignora */ }
  if ((await db.vehicles.count()) > 0) return
  const vehicle_id = await db.vehicles.add({ nome: 'Utilitaria di esempio', marca: 'Marca', modello: 'Modello', targa: 'AB123CD', anno: 2019, alimentazione: 'Benzina', km: 48500, km_data: day(-6), note: '' })
  await db.car_deadlines.bulkAdd([
    { vehicle_id, titolo: 'Rinnovo assicurazione', tipo: 'Assicurazione', data: day(18), km: 0, note: '', fatto: false },
    { vehicle_id, titolo: 'Tagliando', tipo: 'Tagliando', data: '', km: 49000, note: '', fatto: false },
  ])
  await db.car_services.add({ vehicle_id, descrizione: 'Cambio olio e filtri', data: day(-90), km: 45200, officina: 'Officina di esempio', costo: 140, note: '' })
  await db.car_expenses.add({ vehicle_id, descrizione: 'Pedaggi', categoria: 'Pedaggi', importo: 18.4, data: day(-12), note: '' })
  await db.car_fuel.add({ vehicle_id, data: day(-6), litri: 35, prezzo: 1.789, importo: 62.62, km: 48500, note: '' })
  await db.car_docs.add({ vehicle_id, titolo: 'Soccorso stradale', tipo: 'Soccorso stradale', scadenza: '', telefono: '800 000000', link: '', note: 'Numero inventato' })
}
