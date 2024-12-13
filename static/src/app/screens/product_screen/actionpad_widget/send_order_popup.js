import { Component } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { Dialog } from "@web/core/dialog/dialog";
import { AlertDialog, ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { serializeDateTime } from "@web/core/l10n/dates";
import { handleRPCError } from "@point_of_sale/app/errors/error_handlers";
import { ConnectionLostError, RPCError } from "@web/core/network/rpc";

export class SendOrderPopup extends Component {
    static template = "l10n_ec_sync_pos.SendOrderPopup";
    static components = { Dialog };
    static props = {
        close: { type: Function, optional: true },
        orderUuid: String,
    };

    setup() {
        this.dialog = useService("dialog");
        this.pos = this.env.services.pos;

        this.state = {
            selectedSession: null, // Maneja la sesión seleccionada
        };
        this.selectDefaultSession(); // Seleccionar la sesión por omisión

    }

    get currentOrder() {
      return this.pos.get_order();
    }

    cancel() {
        if (this.props.close) {
            this.props.close();
        }
    }

    selectDefaultSession() {
        const firstSession = this.pos.sessions?.find((session) => session.pos_receiver);
        if (firstSession) {
            this.state.selectedSession = firstSession;

            // Marca la fila correspondiente como seleccionada visualmente
            setTimeout(() => {
                const firstRow = document.querySelector(`.session_table tr[data-value="${firstSession.id}"]`);
                if (firstRow) {
                    firstRow.classList.add("highlight");
                }
            }, 0); // Ejecuta después de renderizar el DOM
        }
    }

    highlight_row(event) {
        const row = event.currentTarget;

        // Quita la clase highlight de todas las filas
        document.querySelectorAll(".session_table tr").forEach((r) => r.classList.remove("highlight"));

        // Agrega la clase highlight a la fila seleccionada
        row.classList.add("highlight");

        // Actualiza la sesión seleccionada
        const sessionId = parseInt(row.getAttribute("data-value"));
        this.state.selectedSession = this.pos.sessions.find((session) => session.id === sessionId);
    }



    deleteOrderSent() {
        this.pos.data.resetUnsyncQueue();
        const deleteOrders = this.pos.models["pos.order"].filter((order) => order.uuid == this.props.orderUuid);

        for (const order of deleteOrders) {
            if (order.state=='waiting'){
              this.pos.data.localDeleteCascade(order, false);
            }
        }
        if (!this.pos.get_order()) {
            // this.pos.add_new_order();
            this.pos.selectNextOrder();

        }

    }

    async send() {

        if (!this.currentOrder) {
            this.dialog.add(AlertDialog, {
                title: "Orden Vacía",
                body: "No hay una orden activa para enviar.",
            });
            return;
        }

        if (!this.state.selectedSession) {
            this.dialog.add(AlertDialog, {
                title: "Seleccione una Sesión",
                body: "Debe seleccionar una sesión antes de enviar la orden.",
            });
            return;
        }
        this.pos.setLoadingOrderState(true);
        if (await this.sendOrderToServer()) {
          this.deleteOrderSent();
          this.pos.showScreen("ProductScreen",{});
        }
        this.pos.setLoadingOrderState(false);

      if (this.props.close) {
          this.props.close();
      }
    }


    async sendOrderToServer() {
        this.currentOrder.date_order = serializeDateTime(luxon.DateTime.now());
        this.currentOrder.date_order_pending = serializeDateTime(luxon.DateTime.now());
        this.currentOrder.seller_user_id = this.currentOrder.user_id;
        this.currentOrder.config_id_init = this.currentOrder.config_id;
        this.currentOrder.session_id_init = this.currentOrder.session_id;
        this.currentOrder.sequence_number_init = this.currentOrder.sequence_number;
        this.currentOrder.config_waiting_id = this.state.selectedSession.id;
        this.currentOrder.state = "waiting";
        this.env.services.ui.block();
        let syncOrderResult;
        try {
            syncOrderResult = await this.pos.syncOneOrder(this.currentOrder,{ throw: true });
            if (!syncOrderResult) {
                return;
            }
            return true;  // Retorna true si la sincronización fue exitosa
        } catch (error) {
            if (error instanceof ConnectionLostError) {
                Promise.reject(error);
            } else if (error instanceof RPCError) {
                this.currentOrder.state = "draft";
                handleRPCError(error, this.dialog);
            } else {
                throw error;
            }
            return false;
        } finally {
            this.env.services.ui.unblock();
        }
    }

}
