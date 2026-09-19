/**
 * Supplies the object choices for the Record List LWR component's property editor.
 *
 * Exists because neither of the alternatives works from an Experience Builder
 * property editor: no `lightning/ui*Api` wire adapter enumerates an org's objects
 * (they all need names up front), and a REST call to `/services/data/.../sobjects`
 * returns 404 because the editor's origin does not serve it. Apex describe is the
 * remaining route, and it is how the Flow Config Editor Kit's object picker does the
 * same job.
 *
 * @see RecordListObjectServiceTest
 */
public with sharing class RecordListObjectService {
    /**
     * Suffixes of object kinds that cannot carry a list view.
     *
     * Kept deliberately short. The bulk of the system-generated noise — Feed,
     * History, Share, ChangeEvent and friends — is excluded by
     * `getAssociateEntityType()` instead, which reports the kind directly.
     *
     * Suffix matching alone was wrong and shipped a picker full of `CreditMemoFeed`
     * and `CreditMemoHistory`: only CUSTOM objects get the `__Feed` / `__History`
     * double underscore, so patterns written that way miss every standard one.
     */
    private static final Set<String> EXCLUDED_SUFFIXES = new Set<String>{ '__mdt', '__e', '__x' };

    /**
     * One selectable object, shaped for a combobox.
     */
    public class ObjectOption implements Comparable {
        @AuraEnabled
        public String label;

        @AuraEnabled
        public String apiName;

        public ObjectOption(String label, String apiName) {
            this.label = label;
            this.apiName = apiName;
        }

        /**
         * Sorted by label rather than API name, because the picker shows labels and a
         * list ordered by something the user cannot see reads as unordered.
         */
        public Integer compareTo(Object other) {
            ObjectOption candidate = (ObjectOption) other;
            return this.label.compareTo(candidate.label);
        }
    }

    /**
     * Returns every object the running user can query, sorted by label.
     *
     * Cacheable so the property editor can pull it through the wire service and the
     * platform can cache it — the answer only changes when metadata changes.
     *
     * Usage from a property editor:
     * <pre>
     * import getListableObjects from
     *     "@salesforce/apex/RecordListObjectService.getListableObjects";
     *
     * &#64;wire(getListableObjects)
     * wiredObjects({ data, error }) { ... }
     * </pre>
     *
     * @return Selectable objects, label-sorted. Never null.
     */
    @AuraEnabled(cacheable=true)
    public static List<ObjectOption> getListableObjects() {
        List<ObjectOption> options = new List<ObjectOption>();

        for (Schema.SObjectType objectType : Schema.getGlobalDescribe().values()) {
            Schema.DescribeSObjectResult describe = objectType.getDescribe(
                Schema.SObjectDescribeOptions.DEFERRED
            );
            if (!isSelectable(describe)) {
                continue;
            }
            options.add(new ObjectOption(describe.getLabel(), describe.getName()));
        }

        options.sort();
        return options;
    }

    /**
     * An object earns a place in the picker only if a list view could plausibly
     * exist on it and this user could read it.
     *
     * `isAccessible` keeps the list honest per user: the picker never offers an
     * object whose records the admin configuring the page cannot see.
     *
     * @param describe Deferred describe for the candidate object.
     * @return true when the object should be offered.
     */
    private static Boolean isSelectable(Schema.DescribeSObjectResult describe) {
        if (!describe.isQueryable() || !describe.isAccessible()) {
            return false;
        }
        if (describe.isCustomSetting() || describe.isDeprecatedAndHidden()) {
            return false;
        }

        // Non-null for objects that exist only to support another object — Feed,
        // History, Share, ChangeEvent and so on. Reports the kind regardless of
        // whether the parent is standard or custom, which name matching cannot.
        if (describe.getAssociateEntityType() != null) {
            return false;
        }

        String name = describe.getName();
        for (String suffix : EXCLUDED_SUFFIXES) {
            if (name.endsWith(suffix)) {
                return false;
            }
        }
        return true;
    }
}
