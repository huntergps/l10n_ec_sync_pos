import { patch } from "@web/core/utils/patch";
import { ActionpadWidget } from "@point_of_sale/app/screens/product_screen/action_pad/action_pad";
import { useService } from "@web/core/utils/hooks";

import { handleRPCError } from "@point_of_sale/app/errors/error_handlers";
import { ConnectionLostError, RPCError } from "@web/core/network/rpc";

import { AlertDialog, ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { serializeDateTime } from "@web/core/l10n/dates";
import { Dialog } from "@web/core/dialog/dialog";

import { SendOrderPopup } from "@l10n_ec_sync_pos/app/screens/product_screen/actionpad_widget/send_order_popup";

patch(ActionpadWidget.prototype, {
    setup() {
        this.dialog = useService("dialog");
        super.setup();
    },


    async onClickSendOrder(forzarValidacion) {
        if (await this.pos.isValidOrderToSend(forzarValidacion)) {
          this.dialog.add(SendOrderPopup, {
            orderUuid: this.currentOrder?.uuid,
              close: () => {
                  console.log("Popup cerrado");
              },
          });
        }
    },


    get currentOrder() {
      return this.pos.get_order();
    },




});
