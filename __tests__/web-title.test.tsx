import { describe, expect, it } from '@jest/globals';

import { WebTitle } from '@/src/components/WebTitle';

describe('native web metadata guard', () => {
  it('does not mount Expo Head on a native build without a hosted handoff origin', () => {
    expect(WebTitle()).toBeNull();
  });
});
