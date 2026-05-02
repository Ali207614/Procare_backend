import { SanitizationPipe } from '../../src/common/pipe/sanitization.pipe';

describe('SanitizationPipe', () => {
  let pipe: SanitizationPipe;

  beforeEach(() => {
    pipe = new SanitizationPipe();
  });

  it('sanitizes ordinary string fields', () => {
    expect(
      pipe.transform({
        name: '<script>alert(1)</script>Ali',
        description: '2 < 3 && 5 > 4',
      }),
    ).toEqual({
      name: 'Ali',
      description: '2 &lt; 3 &amp;&amp; 5 &gt; 4',
    });
  });

  it('does not mutate password or token fields', () => {
    const payload = {
      access_token: 'header<payload>&signature',
      confirm_new_password: '2 < 3 && 5 > 4',
      confirm_password: 'same<script>hidden</script>',
      current_password: 'old&password',
      new_password: 'new<password>',
      password: 'p@ss<word>&123',
      refresh_token: 'refresh<token>',
      reset_token: 'reset&token',
    };

    expect(pipe.transform(payload)).toEqual(payload);
  });

  it('preserves nested secret fields while sanitizing normal siblings', () => {
    expect(
      pipe.transform({
        admin: {
          display_name: '<script>alert(1)</script>Ali',
          password: 'x>y',
        },
      }),
    ).toEqual({
      admin: {
        display_name: 'Ali',
        password: 'x>y',
      },
    });
  });
});
