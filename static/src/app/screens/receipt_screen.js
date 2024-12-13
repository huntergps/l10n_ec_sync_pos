
import { patch } from "@web/core/utils/patch";
import { fuzzyLookup } from "@web/core/utils/search";
import { unaccent } from "@web/core/utils/strings";
import { _t } from "@web/core/l10n/translation";
import { parseUTCString } from "@point_of_sale/utils";

import { ReceiptScreen } from "@point_of_sale/app/screens/receipt_screen/receipt_screen";


patch(ReceiptScreen.prototype, {

    setup() {
        super.setup(...arguments);
    },

    get nextScreen() {
      if (this.pos.config.pos_receiver) {
        return { name: "TicketScreen" };
        }
      else {
         return { name: "ProductScreen" };
      }

    },

});
