tart with Google Cloud Vision for the free tier, then evaluate based on your usage patterns.

---

## Troubleshooting

### OpenAI Issues

#### "Invalid API key" Error

**Causes:**
- API key is incorrect or incomplete
- API key doesn't start with `sk-`
- Spaces or line breaks in the API key

**Solutions:**
1. Copy the API key again from [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Ensure no spaces before/after the key
3. Verify the key starts with `sk-`
4. Create a new API key if the old one was revoked

#### "Rate limit exceeded" Error

**Causes:**
- Too many requests in a short time
- Exceeded your account's rate limit

**Solutions:**
1. Wait 1-2 minutes before trying again
2. Process images in smaller batches
3. Upgrade your OpenAI plan for higher limits
4. Enable fallback to use Tesseract when rate limited

#### "Insufficient quota" Error

**Causes:**
- No payment method on file
- Billing account has insufficient funds
- Usage limits reached

**Solutions:**
1. Add a payment method in [OpenAI Billing](https://platform.openai.com/account/billing)
2. Check your usage limits and increase if needed
3. Verify your card has sufficient funds

### Google Cloud Vision Issues

#### "API key not valid" Error

**Causes:**
- API key is incorrect
- API key restrictions prevent access
- Cloud Vision API not enabled

**Solutions:**
1. Copy the API key again from [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials)
2. Verify the key starts with `AIza`
3. Check API restrictions - ensure Cloud Vision API is allowed
4. Verify Cloud Vision API is enabled in [API Library](https://console.cloud.google.com/apis/library)

#### "Quota exceeded" Error

**Causes:**
- Exceeded free tier (1,000 images/month)
- Billing not enabled
- Project quota limits reached

**Solutions:**
1. Check usage in [Cloud Console](https://console.cloud.google.com/apis/api/vision.googleapis.com/quotas)
2. Enable billing if not already enabled
3. Wait until quota resets (monthly)
4. Request quota increase if needed

#### "Permission denied" Error

**Causes:**
- Billing not enabled
- API not enabled for the project
- API key doesn't have permission

**Solutions:**
1. Enable billing for your project
2. Enable Cloud Vision API in [API Library](https://console.cloud.google.com/apis/library)
3. Verify the API key is associated with the correct project

### General Issues

#### "Network error" or "Connection failed"

**Causes:**
- No internet connection
- Firewall blocking API requests
- VPN interfering with connections

**Solutions:**
1. Check your internet connection
2. Try disabling VPN temporarily
3. Check firewall settings
4. Enable fallback to use local OCR when offline

#### "Test Connection" Fails

**Causes:**
- API key not configured
- API key invalid
- Network issues

**Solutions:**
1. Verify API key is entered correctly
2. Check internet connection
3. Try the connection test again after a few seconds
4. Check provider status pages:
   - [OpenAI Status](https://status.openai.com/)
   - [Google Cloud Status](https://status.cloud.google.com/)

#### Images Not Processing

**Causes:**
- Image format not supported
- Image too large (even after preprocessing)
- API errors

**Solutions:**
1. Check console for error messages (Ctrl+Shift+I)
2. Try with a smaller, simpler image
3. Verify preprocessing is enabled
4. Check API usage limits haven't been exceeded

---

## Next Steps

After setting up cloud OCR:

1. **Test with Sample Images**
   - Start with a clear handwritten note
   - Compare results between providers
   - Evaluate accuracy for your handwriting style

2. **Configure Processing Rules**
   - Set up pattern-based routing for your notes
   - See [README.md](README.md#processing-rules) for details

3. **Monitor Costs**
   - Check usage after first week
   - Adjust settings if costs are too high
   - Consider switching providers if needed

4. **Optimize Settings**
   - Adjust image preprocessing limits
   - Configure fallback behavior
   - Enable/disable metadata tracking

---

## Additional Resources

- [OpenAI API Documentation](https://platform.openai.com/docs/guides/vision)
- [Google Cloud Vision Documentation](https://cloud.google.com/vision/docs)
- [Plugin README](README.md)
- [Handwriting OCR Tips](HANDWRITING-TIPS.md)
- [GitHub Issues](https://github.com/yourusername/obsidian-notebook-ocr/issues)

---

**Need Help?**

If you encounter issues not covered in this guide:
1. Check the [Troubleshooting section in README.md](README.md#troubleshooting)
2. Search [GitHub Issues](https://github.com/yourusername/obsidian-notebook-ocr/issues)
3. Create a new issue with:
   - Provider (OpenAI or Google Cloud)
   - Error message
   - Steps to reproduce
   - Console logs (Ctrl+Shift+I)
