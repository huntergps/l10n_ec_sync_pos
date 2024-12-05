import {
    formatFloat, roundDecimals as round_di,
    roundPrecision as round_pr,floatIsZero,
} from "@web/core/utils/numbers";
import { random5Chars, uuidv4 } from "@point_of_sale/utils";
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


patch(PosStore.prototype, {

  afterSenOrderSync(order) {
      const fiscalPosition = this.models["account.fiscal.position"].find((fp) => {
          return fp.id === this.config.default_fiscal_position_id?.id;
      });
      this.session.sequence_number++;
      const uniqId = this.generate_unique_id();
      order.sequence_number = this.session.sequence_number;
      order.access_token = uuidv4();
      order.ticket_code = random5Chars();
      order.fiscal_position_id = fiscalPosition;
      order.name = _t("Order %s", uniqId);
      order.pos_reference = uniqId;
      order.state='done';
      order.set_pricelist(this.config.pricelist_id);
      order.tracking_number =((this.session?.id % 10) * 100 + (this.sequence_number % 100)).toString();
      console.log('order.state : ',order.state);
      return order;
  },

});
