export class Timestamp {
  private constructor(private readonly value: number) {}

  static fromMillis(value: number) {
    return new Timestamp(value);
  }

  toMillis() {
    return this.value;
  }

  get seconds() {
    return Math.floor(this.value / 1000);
  }

  toDate() {
    return new Date(this.value);
  }
}
