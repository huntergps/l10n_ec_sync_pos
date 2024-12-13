import {
    formatFloat, roundDecimals as round_di,
    roundPrecision as round_pr,floatIsZero,
} from "@web/core/utils/numbers";
import { random5Chars, uuidv4, getOnNotified } from "@point_of_sale/utils";
import { _t } from "@web/core/l10n/translation";

import { Component } from "@odoo/owl";
import { usePos } from "@point_of_sale/app/store/pos_hook";
// import { usePos } from "@point_of_sale/app/hooks/pos_hook";
const { DateTime } = luxon;
import { serializeDateTime } from "@web/core/l10n/dates";
import { Dialog } from "@web/core/dialog/dialog";
import { patch } from "@web/core/utils/patch";
// import { PosStore } from "@point_of_sale/app/services/pos_store";
import { PosStore } from "@point_of_sale/app/store/pos_store";
import { TicketScreen } from "@point_of_sale/app/screens/ticket_screen/ticket_screen";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { ActionScreen } from "@point_of_sale/app/screens/action_screen";


patch(PosStore.prototype, {

  // deleteOrdersAtInit() {
  //   this.data.resetUnsyncQueue();
  //   // const orders = this.models["pos.order"];
  //   const orders = this.models["pos.order"].filter(
  //       (order) => order.finalized === true
  //   );
  //
  //   for (const order of orders) {
  //       this.data.localDeleteCascade(order, true);
  //   }
  // },
  //
  // async initServerData() {
  //     await this.processServerData();
  //     this.onNotified = getOnNotified(this.bus, this.config.access_token);
  //     this.deleteOrdersAtInit();
  //     return await this.afterProcessServerData();
  // },
  async getServerOrders() {
    if (this.config.pos_receiver)
    {
      return await this.loadServerOrders([
          ["config_id", "in", [...this.config.raw.trusted_config_ids, this.config.id]],
          ["state", "=", "waiting"],
      ]);
    }
    else {
      return await this.loadServerOrders([
          ["config_id", "in", [...this.config.raw.trusted_config_ids, this.config.id]],
          ["state", "=", "draft"],
      ]);
    }
  },
  async onTicketButtonClick() {
      if (this.isTicketScreenShown) {
          this.closeScreen();
      } else {
        if (this.config.pos_receiver)
        {
              try {
                  this.setLoadingOrderState(true);
                  await this.getServerOrders();
              } finally {
                  this.setLoadingOrderState(false);
                  this.showScreen("TicketScreen");
              }
      }

    else {
      if (this._shouldLoadOrders()) {
          try {
              this.setLoadingOrderState(true);
              await this.getServerOrders();
          } finally {
              this.setLoadingOrderState(false);
              this.showScreen("TicketScreen");
          }
      } else {
          this.showScreen("TicketScreen");
      }
    }
  }
  },
  async syncAllOrders1111(options = {}) {
      const { orderToCreate, orderToUpdate } = this.getPendingOrder();
      let orders = [...orderToCreate, ...orderToUpdate];
      // Filter out orders that are already being synced
      orders = orders.filter((order) => !this.syncingOrders.has(order.id));

      try {
          const orderIdsToDelete = this.getOrderIdsToDelete();
          if (orderIdsToDelete.length > 0) {
              await this.deleteOrders([], orderIdsToDelete);
          }

          const context = this.getSyncAllOrdersContext(orders, options);
          await this.preSyncAllOrders(orders);

          // Allow us to force the sync of the orders In the case of
          // pos_restaurant is usefull to get unsynced orders
          // for a specific table
          if (orders.length === 0 && !context.force) {
              return;
          }

          // Add order IDs to the syncing set
          orders.forEach((order) => this.syncingOrders.add(order.id));

          // Re-compute all taxes, prices and other information needed for the backend
          for (const order of orders) {
              order.recomputeOrderData();
          }

          const serializedOrder = orders.map((order) =>
              order.serialize({ orm: true, clear: true })
          );
          const data = await this.data.call("pos.order", "sync_from_ui", [serializedOrder], {
              context,
          });
          const missingRecords = await this.data.missingRecursive(data);
          const newData = this.models.loadData(missingRecords);

          for (const line of newData["pos.order.line"]) {
              const refundedOrderLine = line.refunded_orderline_id;

              if (refundedOrderLine) {
                  const order = refundedOrderLine.order_id;
                  delete order.uiState.lineToRefund[refundedOrderLine.uuid];
                  refundedOrderLine.refunded_qty += Math.abs(line.qty);
              }
          }

          this.postSyncAllOrders(newData["pos.order"]);

          if (data["pos.session"].length > 0) {
              // Replace the original session by the rescue one. And the rescue one will have
              // a higher id than the original one since it's the last one created.
              const session = this.models["pos.session"].sort((a, b) => a.id - b.id)[0];
              session.delete();
              this.models["pos.order"]
                  .getAll()
                  .filter((order) => order.state === "draft")
                  .forEach((order) => (order.session_id = this.session));
          }

          this.clearPendingOrder();
          return newData["pos.order"];
      } catch (error) {
          if (options.throw) {
              throw error;
          }

          console.warn("Offline mode active, order will be synced later");
          return error;
      } finally {
          orders.forEach((order) => this.syncingOrders.delete(order.id));
      }
  }
,
  async processServerData() {
        await super.processServerData(...arguments);
        let pos_config = await this.env.services.orm.call(
            "pos.config",
            "get_config",
            [[]],
        )
        this.sessions = pos_config

    },


    async syncOneOrder(order, options = {}) {
        // Verifica que la orden sea válida y no esté siendo sincronizada actualmente
        if (!order || this.syncingOrders.has(order.id)) {
            return false;
        }

        try {
            // Agrega la orden al conjunto de órdenes que están siendo sincronizadas
            this.syncingOrders.add(order.id);

            // Recalcula impuestos, precios y otra información necesaria para el backend
            order.recomputeOrderData();

            // Serializa la orden para enviarla al backend

            const serializedOrder = order.serialize({ orm: true, clear: true });
            const context = this.getSyncAllOrdersContext([order], options);
            // if (serializedOrder['config_id_waiting']==false){
            //   serializedOrder['config_id_waiting']=order.config_id_waiting.id
            // }
            // Llama al backend para sincronizar la orden
            const data = await this.data.call("pos.order", "sync_from_ui", [[serializedOrder]], { context });

            // Elimina la orden sincronizada del conjunto de órdenes pendientes
            this.removePendingOrder(order);

            return true;  // Devuelve true si la sincronización fue exitosa
        } catch (error) {
            if (options.throw) {
                throw error;
            }
            console.warn("Modo sin conexión activo, la orden se sincronizará más tarde.");
            return false;  // Devuelve false si ocurrió un error durante la sincronización
        } finally {
            // Elimina la orden del conjunto de órdenes que están siendo sincronizadas
            this.syncingOrders.delete(order.id);
        }
    },

    get firstScreen() {
        if (odoo.from_backend) {
            // Remove from_backend params in the URL but keep the rest
            const url = new URL(window.location.href);
            url.searchParams.delete("from_backend");
            window.history.replaceState({}, "", url);

            if (!this.config.module_pos_hr) {
                this.set_cashier(this.user);
            }
        }

        if (!this.cashier) {
            // No cashier: if pos_receiver is true, show TicketScreen, otherwise ProductScreen
            return this.config.pos_receiver ? "TicketScreen" : "ProductScreen";
        } else {
            // If there's a cashier, check pos_receiver to decide the screen
            return this.config.pos_receiver ? "TicketScreen" : "ProductScreen";
        }

        return screen
    },
    // return the current order
    get_order() {
        if (!this.selectedOrderUuid) {
            return undefined;
        }

        let myorder= this.models["pos.order"].getBy("uuid", this.selectedOrderUuid);
        return myorder;
    },
    // change the current order
    set_order(order, options) {
        if (this.get_order()) {
            this.get_order().updateSavedQuantity();
        }
        this.selectedOrderUuid = order?.uuid;
    },
    async afterProcessServerData() {
        // Adding the not synced paid orders to the pending orders
        const paidUnsyncedOrderIds = this.models["pos.order"]
            .filter((order) => order.isUnsyncedPaid)
            .map((order) => order.id);
        if (paidUnsyncedOrderIds.length > 0) {
            this.addPendingOrder(paidUnsyncedOrderIds);
        }

        const openOrders = this.data.models["pos.order"].filter((order) => order.state=='waiting');
        this.syncAllOrders();
        if (!this.config.module_pos_restaurant) {
            this.selectedOrderUuid = openOrders.length
                ? openOrders[openOrders.length - 1].uuid
                : this.add_new_order().uuid;
        }

        this.markReady();
        this.showScreen(this.firstScreen);
    },
    async onClickBackButton() {
      if (this.config.pos_receiver) {

        if (this.mainScreen.component === TicketScreen) {
            if (this.ticket_screen_mobile_pane == "left") {
              this.showScreen("TicketScreen");
            } else {
                this.ticket_screen_mobile_pane = "left";
            }
        } else if (
            this.mobile_pane == "left" ||
            [PaymentScreen, ActionScreen].includes(this.mainScreen.component)
        ) {
            this.mobile_pane = this.mainScreen.component === PaymentScreen ? "left" : "right";
            this.showScreen("TicketScreen");
        }
      }
      else {
        super.onClickBackButton(...arguments);

      }

    },

    async isValidOrderToSend(forzarValidacion) {
      const currentOrder = this.get_order();
      if (!currentOrder) {
          this.dialog.add(AlertDialog, {
              title: "Orden Vacía",
              body: "No hay una orden activa para enviar.",
          });
          return;
      }


        if (currentOrder.get_orderlines().length === 0 && currentOrder.is_to_invoice()) {
            this.dialog.add(AlertDialog, {
                title: _t("Empty Order"),
                body: _t(
                    "There must be at least one product in your order before it can be validated and invoiced."
                ),
            });
            return false;
        }
        if (
            (currentOrder.is_to_invoice() || currentOrder.getShippingDate()) &&
            !currentOrder.get_partner()
        ) {
            const confirmed = await ask(this.dialog, {
                title: _t("Please select the Customer"),
                body: _t(
                    "You need to select the customer before you can invoice or ship an order."
                ),
            });
            if (confirmed) {
                this.pos.selectPartner();
            }
            return false;
        }

        const partner = currentOrder.get_partner();
        if (
            currentOrder.getShippingDate() &&
            !(partner.name && partner.street && partner.city && partner.country_id)
        ) {
            this.dialog.add(AlertDialog, {
                title: _t("Incorrect address for shipping"),
                body: _t("The selected customer needs an address."),
            });
            return false;
        }
        return true;
    },



});
