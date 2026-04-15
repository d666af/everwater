import ManagerOrders from '../manager/ManagerOrders'
import AdminLayout from '../../components/admin/AdminLayout'

export default function AdminOrders() {
  return <ManagerOrders Layout={AdminLayout} title="Заказы" />
}
