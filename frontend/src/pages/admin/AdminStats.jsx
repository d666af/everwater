import ManagerStats from '../manager/ManagerStats'
import AdminLayout from '../../components/admin/AdminLayout'

export default function AdminStats() {
  return <ManagerStats Layout={AdminLayout} title="Статистика" showExtended={true} />
}
