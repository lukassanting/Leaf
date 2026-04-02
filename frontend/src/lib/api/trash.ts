import axios from 'axios'
import { API_BASE_URL } from '../apiBase'
import type { TrashListResponse, TrashPurgeAllResponse } from './types'

const base = API_BASE_URL

export const trashApi = {
  list: () =>
    axios.get<TrashListResponse>(`${base}/trash`).then((r) => r.data),

  permanentDeleteLeaf: (leafId: string) =>
    axios.delete(`${base}/trash/leaves/${leafId}`),

  permanentDeleteDatabase: (databaseId: string) =>
    axios.delete(`${base}/trash/databases/${databaseId}`),

  purgeAll: () =>
    axios.post<TrashPurgeAllResponse>(`${base}/trash/purge-all`).then((r) => r.data),
}
