import WarehouseStock from '../warehouse/WarehouseStock'
import AdminLayout from '../../components/admin/AdminLayout'

export default function AdminWarehouse() {
  return <WarehouseStock Layout={AdminLayout} title="Склад" />
}
