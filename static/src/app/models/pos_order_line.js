
import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";
import { PosOrderline } from "@point_of_sale/app/models/pos_order_line";

import { constructFullProductName, uuidv4 } from "@point_of_sale/utils";
import { Base } from "@point_of_sale/app/models/related_models";
import { parseFloat } from "@web/views/fields/parsers";
import { formatFloat, roundDecimals, roundPrecision, floatIsZero } from "@web/core/utils/numbers";
import { roundCurrency, formatCurrency } from "@point_of_sale/app/models/utils/currency";

import {
    getTaxesAfterFiscalPosition,
    getTaxesValues,
} from "@point_of_sale/app/models/utils/tax_utils";



patch(PosOrderline.prototype, {


get_unitNew() {
    return this.product_uom_id || this.product_id.uom_id;
},


});
