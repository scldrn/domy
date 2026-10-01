import { createCn } from "cn/config";

/**
 * Class merging that knows the M3 type scale (`text-title-m`, …) is a font size, so it never
 * drops a text color such as `text-on-primary` next to it.
 */
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: ["display", "headline", "title", "body", "label"].flatMap((role) =>
            ["l", "m", "s"].map((size) => `${role}-${size}`),
          ),
        },
      ],
    },
  },
});
