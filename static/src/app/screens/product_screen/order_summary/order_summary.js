
import { patch } from "@web/core/utils/patch";
import { OrderSummary } from "@point_of_sale/app/screens/product_screen/order_summary/order_summary";

patch(OrderSummary.prototype, {
    clickLine(ev, orderline) {
        if (orderline.isSelected()) {
            return;
        } else {
            super.clickLine(ev, orderline);
        }
    },
});
