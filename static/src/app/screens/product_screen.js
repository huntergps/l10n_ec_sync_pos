import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";
import { SendOrderPopup } from "@l10n_ec_sync_pos/app/screens/product_screen/actionpad_widget/send_order_popup";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";

patch(ProductScreen.prototype, {
    /**
     * @override
     */
    setup() {
      this.dialog = useService("dialog");
        super.setup(...arguments);
    },
    async onClickSendOrderSmall(forzarValidacion) {
        if (await this.pos.isValidOrderToSend(forzarValidacion)) {
          this.dialog.add(SendOrderPopup, {
            orderUuid: this.currentOrder?.uuid,
              close: () => {
                  console.log("Popup cerrado");
              },
          });
        }
    },


});
