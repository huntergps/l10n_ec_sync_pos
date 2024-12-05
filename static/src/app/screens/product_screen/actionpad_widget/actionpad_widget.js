import { patch } from "@web/core/utils/patch";
import { ActionpadWidget } from "@point_of_sale/app/screens/product_screen/action_pad/action_pad";
import { useService } from "@web/core/utils/hooks";

import { handleRPCError } from "@point_of_sale/app/errors/error_handlers";
import { ConnectionLostError, RPCError } from "@web/core/network/rpc";

import { AlertDialog, ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { serializeDateTime } from "@web/core/l10n/dates";

/**
 * @props partner
 */

patch(ActionpadWidget.prototype, {
    setup() {
        this.dialog = useService("dialog");
        super.setup();
    },
      get currentOrder() {
        return this.pos.get_order();
    },
      sendOrderToServer() {
        this.pos.setLoadingOrderState(true);
        this.pos.push_single_order(this.currentOrder);
        this.pos.afterSenOrderSync(this.currentOrder);
        this.pos.setLoadingOrderState(true);

    },

    async validateOrder(isForceValidate) {
        if (await this._isOrderValid(isForceValidate)) {
            await this._finalizeValidation();
        }
    },

    async _isOrderValid(isForceValidate) {
        if (this.currentOrder.get_orderlines().length === 0 && this.currentOrder.is_to_invoice()) {
            this.dialog.add(AlertDialog, {
                title: _t("Empty Order"),
                body: _t(
                    "There must be at least one product in your order before it can be validated and invoiced."
                ),
            });
            return false;
        }
        if (
            (this.currentOrder.is_to_invoice() || this.currentOrder.getShippingDate()) &&
            !this.currentOrder.get_partner()
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

        const partner = this.currentOrder.get_partner();
        if (
            this.currentOrder.getShippingDate() &&
            !(partner.name && partner.street && partner.city && partner.country_id)
        ) {
            this.dialog.add(AlertDialog, {
                title: _t("Incorrect address for shipping"),
                body: _t("The selected customer needs an address."),
            });
            return false;
        }

        if (!this.currentOrder._isValidEmptyOrder()) {
            return false;
        }

        return true;
    },

    async _finalizeValidation() {
        this.currentOrder.date_order = serializeDateTime(luxon.DateTime.now());
        this.pos.addPendingOrder([this.currentOrder.id]);
        // this.currentOrder.state = "paid";

        this.env.services.ui.block();
        let syncOrderResult;
        try {
            // 1. Save order to server.
            syncOrderResult = await this.pos.syncAllOrders({ throw: true });
            if (!syncOrderResult) {
                return;
            }
        } catch (error) {
            if (error instanceof ConnectionLostError) {
                Promise.reject(error);
            } else if (error instanceof RPCError) {
                this.currentOrder.state = "pending";
                handleRPCError(error, this.dialog);
            } else {
                throw error;
            }
            return error;
        } finally {
            this.env.services.ui.unblock();
        }

        // 2. Post process.
        if (
            syncOrderResult &&
            syncOrderResult.length > 0 &&
            this.currentOrder.wait_for_push_order()
        ) {
            await this.postPushOrderResolve(syncOrderResult.map((res) => res.id));
        }

        await this.afterOrderValidation(!!syncOrderResult && syncOrderResult.length > 0);
    },

    async postPushOrderResolve(ordersServerId) {
        const postPushResult = await this._postPushOrderResolve(this.currentOrder, ordersServerId);
        if (!postPushResult) {
            this.dialog.add(AlertDialog, {
                title: _t("Error: no internet connection."),
                body: _t("Some, if not all, post-processing after syncing order failed."),
            });
        }
    },
    async afterOrderValidation() {

        let orderlines = [...this.currentOrder.get_orderlines()];
        if (orderlines.length > 0) {
                orderlines.map(async (line) => {
                await this.currentOrder.removeOrderline(line);
              })
        }
        this.pos.afterSenOrderSync(this.currentOrder)
        // this.currentOrder.setDirty();
        // this.currentOrder.get_newUUID();
        // this.currentOrder.uiState.screen_data.value = "";
        // this.currentOrder.uiState.locked = true;
        // this.pos.searchProductWord = "";
        // this.pos.showScreen("ProductScreen");
        // await this.pos.onDeleteOrderCache(this.currentOrder);
        // this.dialog.closeAll();
        // this.orderDone()

    },
    _addNewOrder() {
        this.pos.add_new_order();
    },
    orderDone() {
        this.currentOrder.uiState.screen_data.value = "";
        this.currentOrder.uiState.locked = true;
        this._addNewOrder();
        this.pos.searchProductWord = "";
        const { name, props } = "ProductScreen";
        // this.pos.showScreen(name, props);
    }


});
